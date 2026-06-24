const { GoogleGenerativeAI } = require("@google/generative-ai");
const db = require("../database");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 상품 ID를 받아 리뷰를 분석하고 DB에 결과를 저장하는 공용 함수
async function runAIAnalysis(productId) {
  const product = db
    .prepare("SELECT * FROM products WHERE id = ?")
    .get(productId);

  if (!product) {
    throw new Error("상품을 찾을 수 없습니다.");
  }

  const reviews = db
    .prepare("SELECT content, rating FROM reviews WHERE product_id = ?")
    .all(productId);

  if (reviews.length === 0) {
    throw new Error("분석할 리뷰가 없습니다.");
  }

  const reviewTexts = reviews
    .map((r, i) => `${i + 1}. [별점 ${r.rating}점] ${r.content}`)
    .join("\n");

  // ✅ Gemini 모델 설정 — JSON만 출력, 토큰 넉넉히(8192)
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
    },
  });

  const prompt = `다음 상품 리뷰들을 분석해서 JSON 형식으로만 답해주세요. 다른 텍스트나 마크다운은 절대 포함하지 마세요.

상품명: ${product.name}
리뷰 목록:
${reviewTexts}

응답 형식 (반드시 이 JSON만):
{
  "positive": 긍정 비율(숫자만, 예: 80),
  "negative": 부정 비율(숫자만, 예: 20),
  "pros": "핵심 장점 한 문장 (리뷰 기반으로 구체적으로)",
  "cons": "핵심 단점 한 문장 (리뷰 기반으로 구체적으로)",
  "conclusion": "이 상품을 추천할 대상 한 문장",
  "keywords": [
    {
      "label": "키워드1",
      "count": 언급횟수(숫자),
      "sentences": ["관련 리뷰 문장1", "관련 리뷰 문장2"]
    },
    {
      "label": "키워드2",
      "count": 언급횟수(숫자),
      "sentences": ["관련 리뷰 문장1"]
    }
  ]
}

키워드는 리뷰에서 자주 언급되는 핵심 주제 3~5개를 뽑아주세요. (예: 소음, 크기, 세탁력, 디자인 등)
sentences는 실제 리뷰에서 해당 키워드와 관련된 문장을 그대로 추출하거나 요약해서 최대 3개까지 넣어주세요.`;

  // ✅ 429(분당 한도)/503(서버 혼잡) 시 자동 재시도 (최대 4회, 점점 더 오래 대기)
  let response;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      response = await model.generateContent(prompt);
      break;
    } catch (err) {
      const msg = String(err?.message || "");
      const retryable = msg.includes("429") || msg.includes("503");
      if (!retryable || attempt === 3) throw err;
      const waitMs = 40000 * (attempt + 1); // 40s, 80s, 120s
      console.log(`  ⏳ 재시도 대기 ${waitMs / 1000}초... (${attempt + 1}/4)`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  const text = response.response.text().trim();
  // 혹시 모를 코드블록 제거
  const cleaned = text.replace(/^```json\n?/, "").replace(/\n?```$/, "");
  const result = JSON.parse(cleaned);

  const updateAll = db.transaction(() => {
    db.prepare(
      `UPDATE products
       SET ai_positive = ?, ai_negative = ?, ai_pros = ?, ai_cons = ?, ai_conclusion = ?, ai_analyzed_at = datetime('now')
       WHERE id = ?`
    ).run(
      result.positive,
      result.negative,
      result.pros,
      result.cons,
      result.conclusion,
      productId
    );

    const existingKeywords = db
      .prepare("SELECT id FROM keywords WHERE product_id = ?")
      .all(productId);

    for (const kw of existingKeywords) {
      db.prepare("DELETE FROM keyword_sentences WHERE keyword_id = ?").run(
        kw.id
      );
    }
    db.prepare("DELETE FROM keywords WHERE product_id = ?").run(productId);

    if (result.keywords && Array.isArray(result.keywords)) {
      for (let i = 0; i < result.keywords.length; i++) {
        const kw = result.keywords[i];
        const kwId = `${productId}-ai-kw-${i}-${Date.now()}`;

        db.prepare(
          "INSERT INTO keywords (id, product_id, label, count) VALUES (?, ?, ?, ?)"
        ).run(kwId, productId, kw.label, kw.count || 0);

        if (Array.isArray(kw.sentences)) {
          for (const sentence of kw.sentences) {
            db.prepare(
              "INSERT INTO keyword_sentences (keyword_id, sentence) VALUES (?, ?)"
            ).run(kwId, sentence);
          }
        }
      }
    }
  });

  updateAll();

  return result;
}

module.exports = { runAIAnalysis };

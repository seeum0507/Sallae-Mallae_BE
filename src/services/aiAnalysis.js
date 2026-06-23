const Anthropic = require("@anthropic-ai/sdk");
const db = require("../database");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 상품 ID를 받아 리뷰를 분석하고 DB에 결과를 저장하는 공용 함수
// - routes/ai.js (수동 분석 요청)
// - routes/reviews.js (리뷰 작성 후 자동 재분석)
// - database.js (서버 시작 시 초기 분석)
// 세 곳에서 모두 이 함수 하나만 호출하도록 통합함
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

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `다음 상품 리뷰들을 분석해서 JSON 형식으로만 답해주세요. 다른 텍스트나 마크다운은 절대 포함하지 마세요.

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
sentences는 실제 리뷰에서 해당 키워드와 관련된 문장을 그대로 추출하거나 요약해서 최대 3개까지 넣어주세요.`,
      },
    ],
  });

  const text = response.content[0].text.trim();
  const cleaned = text.replace(/^```json\n?/, "").replace(/\n?```$/, "");
  const result = JSON.parse(cleaned);

  const updateAll = db.transaction(() => {
    // ✅ ai_analyzed_at 타임스탬프를 함께 기록해서 "분석 완료 여부"를 판단할 수 있게 함
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

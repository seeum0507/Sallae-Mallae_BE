const express = require("express");
const router = express.Router();
const Anthropic = require("@anthropic-ai/sdk");
const db = require("../database");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.post("/analyze/:productId", async (req, res) => {
  const product = db
    .prepare("SELECT * FROM products WHERE id = ?")
    .get(req.params.productId);
  if (!product)
    return res.status(404).json({ error: "상품을 찾을 수 없습니다." });

  const reviews = db
    .prepare("SELECT content FROM reviews WHERE product_id = ?")
    .all(req.params.productId);

  if (reviews.length === 0) {
    return res.status(400).json({ error: "분석할 리뷰가 없습니다." });
  }

  const reviewTexts = reviews
    .map((r, i) => `${i + 1}. ${r.content}`)
    .join("\n");

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `다음 상품 리뷰들을 분석해서 JSON 형식으로만 답해주세요. 다른 텍스트는 절대 포함하지 마세요.

리뷰 목록:
${reviewTexts}

응답 형식:
{
  "positive": 긍정 비율(숫자만, 예: 80),
  "negative": 부정 비율(숫자만, 예: 20),
  "pros": "핵심 장점 한 문장",
  "cons": "핵심 단점 한 문장",
  "conclusion": "추천 대상 한 문장"
}`,
        },
      ],
    });

    const text = response.content[0].text.trim();
    const result = JSON.parse(text);

    db.prepare(
      `
      UPDATE products
      SET ai_positive = ?, ai_negative = ?, ai_pros = ?, ai_cons = ?, ai_conclusion = ?
      WHERE id = ?
    `
    ).run(
      result.positive,
      result.negative,
      result.pros,
      result.cons,
      result.conclusion,
      req.params.productId
    );

    res.json({ success: true, ...result });
  } catch (err) {
    console.error("AI 분석 오류:", err);
    res.status(500).json({ error: "AI 분석 중 오류가 발생했습니다." });
  }
});

router.post("/sentiment", async (req, res) => {
  const { content } = req.body;
  if (!content)
    return res.status(400).json({ error: "리뷰 내용을 입력해주세요." });

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: `다음 리뷰가 긍정인지 부정인지 분석해서 JSON으로만 답해주세요.
리뷰: "${content}"
형식: {"sentiment": "positive" 또는 "negative", "score": 0~100 사이 긍정 점수}`,
        },
      ],
    });

    const result = JSON.parse(response.content[0].text.trim());
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "분석 실패" });
  }
});

module.exports = router;

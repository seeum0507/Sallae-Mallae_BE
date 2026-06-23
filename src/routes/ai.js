const express = require("express");
const router = express.Router();
const Anthropic = require("@anthropic-ai/sdk");
const db = require("../database");
const { runAIAnalysis } = require("../services/aiAnalysis");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 상품 전체 분석 (3줄 요약 + 키워드 추출 모두 AI가 수행)
router.post("/analyze/:productId", async (req, res) => {
  try {
    const result = await runAIAnalysis(req.params.productId);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("AI 분석 오류:", err);
    if (err.message === "상품을 찾을 수 없습니다.") {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === "분석할 리뷰가 없습니다.") {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: "AI 분석 중 오류가 발생했습니다." });
  }
});

// 단일 리뷰 감성 분석
router.post("/sentiment", async (req, res) => {
  const { content } = req.body;
  if (!content)
    return res.status(400).json({ error: "리뷰 내용을 입력해주세요." });

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: `다음 리뷰가 긍정인지 부정인지 분석해서 JSON으로만 답해주세요. 다른 텍스트 없이 JSON만.
리뷰: "${content}"
형식: {"sentiment": "positive" 또는 "negative", "score": 0~100 사이 긍정 점수}`,
        },
      ],
    });

    const text = response.content[0].text.trim();
    const cleaned = text.replace(/^```json\n?/, "").replace(/\n?```$/, "");
    const result = JSON.parse(cleaned);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "분석 실패" });
  }
});

module.exports = router;

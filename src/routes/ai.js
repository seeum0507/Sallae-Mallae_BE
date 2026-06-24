const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const db = require("../database");
const { runAIAnalysis } = require("../services/aiAnalysis");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 상품 전체 분석 (3줄 요약 + 키워드 추출)
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
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 100,
      },
    });

    const prompt = `다음 리뷰가 긍정인지 부정인지 분석해서 JSON으로만 답해주세요. 다른 텍스트 없이 JSON만.
리뷰: "${content}"
형식: {"sentiment": "positive" 또는 "negative", "score": 0~100 사이 긍정 점수}`;

    const response = await model.generateContent(prompt);
    const text = response.response.text().trim();
    const cleaned = text.replace(/^```json\n?/, "").replace(/\n?```$/, "");
    res.json(JSON.parse(cleaned));
  } catch (err) {
    console.error("감성 분석 오류:", err);
    res.status(500).json({ error: "분석 실패" });
  }
});

// ✅ AI 상품 이미지 생성 — DB 링크가 깨졌을 때 프론트가 이 주소로 요청함
// 한 번 생성하면 uploads/ai-products 폴더에 저장해두고 다음부터는 캐시 사용
const AI_IMG_DIR = path.join(__dirname, "..", "uploads", "ai-products");
if (!fs.existsSync(AI_IMG_DIR)) fs.mkdirSync(AI_IMG_DIR, { recursive: true });

router.get("/product-image/:productId", async (req, res) => {
  const { productId } = req.params;
  const filePath = path.join(AI_IMG_DIR, `${productId}.png`);

  // 이미 만들어둔 이미지가 있으면 그대로 반환 (캐싱)
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  const product = db
    .prepare("SELECT name, brand, category FROM products WHERE id = ?")
    .get(productId);

  if (!product) {
    return res.status(404).json({ error: "상품을 찾을 수 없습니다." });
  }

  try {
    // Nano Banana(이미지 생성 모델)로 제품명 기반 사진 생성
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-image-preview",
    });

    const prompt = `Product photo of "${product.name}" (brand: ${product.brand}, category: ${product.category}). Clean white studio background, centered, professional e-commerce product photography, soft lighting, high quality, no text, no watermark.`;

    const result = await model.generateContent(prompt);
    const parts = result.response?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData);

    if (!imagePart) throw new Error("이미지 데이터를 받지 못했습니다.");

    const buffer = Buffer.from(imagePart.inlineData.data, "base64");
    fs.writeFileSync(filePath, buffer); // 캐시 저장

    res.set("Content-Type", "image/png");
    res.send(buffer);
  } catch (err) {
    console.error(`AI 이미지 생성 오류(${productId}):`, err.message);
    res.status(500).json({ error: "AI 이미지 생성 실패" });
  }
});

module.exports = router;

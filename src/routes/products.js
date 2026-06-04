const express = require("express");
const router = express.Router();
const db = require("../database");
const authMiddleware = require("../middleware/auth");

// 상품 목록
router.get("/", (req, res) => {
  const { q, category } = req.query;

  let query = "SELECT * FROM products WHERE 1=1";
  const params = [];

  if (category && category !== "all") {
    query += " AND category_key = ?";
    params.push(category);
  }

  if (q) {
    query += " AND (name LIKE ? OR brand LIKE ? OR category LIKE ?)";
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const products = db.prepare(query).all(...params);
  res.json(products.map((p) => formatProduct(p)));
});

// 상품 상세
router.get("/:id", (req, res) => {
  const product = db
    .prepare("SELECT * FROM products WHERE id = ?")
    .get(req.params.id);

  if (!product) {
    return res.status(404).json({ error: "상품을 찾을 수 없습니다." });
  }

  res.json(formatProduct(product, true));
});

// 찜 상태 조회 (로그인 필요)
router.get("/:id/like", authMiddleware, (req, res) => {
  const existing = db
    .prepare("SELECT id FROM likes WHERE user_id = ? AND product_id = ?")
    .get(req.user.id, req.params.id);
  res.json({ liked: !!existing });
});

// 찜 토글 (로그인 필요)
router.post("/:id/like", authMiddleware, (req, res) => {
  const { id: productId } = req.params;
  const { id: userId } = req.user;

  const product = db
    .prepare("SELECT id FROM products WHERE id = ?")
    .get(productId);
  if (!product) {
    return res.status(404).json({ error: "상품을 찾을 수 없습니다." });
  }

  const existing = db
    .prepare("SELECT id FROM likes WHERE user_id = ? AND product_id = ?")
    .get(userId, productId);

  if (existing) {
    db.prepare("DELETE FROM likes WHERE user_id = ? AND product_id = ?").run(
      userId,
      productId
    );
    res.json({ liked: false });
  } else {
    db.prepare("INSERT INTO likes (user_id, product_id) VALUES (?, ?)").run(
      userId,
      productId
    );
    res.json({ liked: true });
  }
});

// ✅ 핵심: 모든 수치를 실제 reviews 테이블에서 계산
function formatProduct(p, includeReviews = false) {
  // 실제 리뷰 데이터 조회
  const allReviews = db
    .prepare("SELECT rating FROM reviews WHERE product_id = ?")
    .all(p.id);

  const actualReviewCount = allReviews.length;

  // 실제 평균 별점 계산 (리뷰 없으면 seed 값 유지)
  let actualRating = p.rating;
  if (actualReviewCount > 0) {
    const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
    actualRating = Math.round((totalRating / actualReviewCount) * 10) / 10;
  }

  // 실제 긍정/부정 비율 계산 (rating 4~5 = 긍정, 1~2 = 부정, 3 = 중립→긍정으로 포함)
  let positive = p.ai_positive;
  let negative = p.ai_negative;
  if (actualReviewCount > 0) {
    const positiveCount = allReviews.filter((r) => r.rating >= 4).length;
    positive = Math.round((positiveCount / actualReviewCount) * 100);
    negative = 100 - positive;
  }

  const keywords = db
    .prepare("SELECT * FROM keywords WHERE product_id = ?")
    .all(p.id);
  const keywordsWithSentences = keywords.map((k) => ({
    id: k.id,
    label: k.label,
    count: k.count,
    sentences: db
      .prepare("SELECT sentence FROM keyword_sentences WHERE keyword_id = ?")
      .all(k.id)
      .map((s) => s.sentence),
  }));

  const photoReviews = db
    .prepare("SELECT * FROM photo_reviews WHERE product_id = ?")
    .all(p.id);

  const formatted = {
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    categoryKey: p.category_key,
    price: p.price,
    originalPrice: p.original_price,
    rating: actualRating, // ✅ 실제 평균 별점
    reviewCount: actualReviewCount, // ✅ 실제 리뷰 수
    recommendCount: p.recommend_count,
    thumbnail: p.thumbnail,
    aiSentiment: {
      positive, // ✅ 실제 별점 기반 긍정률
      negative, // ✅ 실제 별점 기반 부정률
    },
    aiSummary: {
      pros: p.ai_pros,
      cons: p.ai_cons,
      conclusion: p.ai_conclusion,
    },
    keywords: keywordsWithSentences,
    photoReviews: photoReviews.map((ph) => ({
      id: ph.id,
      url: ph.url,
      rating: ph.rating,
      likes: ph.likes,
    })),
  };

  if (includeReviews) {
    formatted.reviews = db
      .prepare(
        "SELECT * FROM reviews WHERE product_id = ? ORDER BY helpful DESC"
      )
      .all(p.id)
      .map((r) => formatReview(r));
  }

  return formatted;
}

function formatReview(r) {
  const images = db
    .prepare("SELECT url FROM review_images WHERE review_id = ?")
    .all(r.id)
    .map((i) => i.url);

  return {
    id: r.id,
    author: r.author,
    initial: r.initial,
    avatarColor: r.avatar_color,
    date: r.date,
    rating: r.rating,
    content: r.content,
    helpful: r.helpful,
    replies: r.replies,
    images,
  };
}

module.exports = router;

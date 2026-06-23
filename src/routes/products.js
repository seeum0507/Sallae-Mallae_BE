const express = require("express");
const router = express.Router();
const db = require("../database");
const authMiddleware = require("../middleware/auth");

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

router.get("/:id", (req, res) => {
  const product = db
    .prepare("SELECT * FROM products WHERE id = ?")
    .get(req.params.id);
  if (!product) {
    return res.status(404).json({ error: "상품을 찾을 수 없습니다." });
  }
  res.json(formatProduct(product, true));
});

router.get("/:id/like", authMiddleware, (req, res) => {
  const existing = db
    .prepare("SELECT id FROM likes WHERE user_id = ? AND product_id = ?")
    .get(req.user.id, req.params.id);
  res.json({ liked: !!existing });
});

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

function formatProduct(p, includeReviews = false) {
  const allReviews = db
    .prepare("SELECT rating FROM reviews WHERE product_id = ?")
    .all(p.id);

  const actualReviewCount = allReviews.length;

  let actualRating = p.rating;
  if (actualReviewCount > 0) {
    const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
    actualRating = Math.round((totalRating / actualReviewCount) * 10) / 10;
  }

  const positive = p.ai_positive || 0;
  const negative = p.ai_negative || 0;

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

  // ✅ 변경: 사진을 review_id 기준으로 그룹핑해서
  //    "한 사람(한 리뷰)이 올린 사진들"을 하나의 카드(urls 배열)로 묶음
  const photoRows = db
    .prepare(
      `SELECT ri.id as imageId, ri.review_id as reviewId, ri.url,
              r.rating, r.content, r.author, r.date, r.initial, r.avatar_color, r.helpful
       FROM review_images ri
       JOIN reviews r ON ri.review_id = r.id
       WHERE r.product_id = ?
       ORDER BY ri.id ASC`
    )
    .all(p.id);

  const photoMap = new Map();
  for (const row of photoRows) {
    if (!photoMap.has(row.reviewId)) {
      photoMap.set(row.reviewId, {
        id: row.reviewId,
        urls: [],
        rating: row.rating,
        likes: row.helpful || 0,
        content: row.content,
        author: row.author,
        date: row.date,
        initial: row.initial,
        avatarColor: row.avatar_color,
      });
    }
    photoMap.get(row.reviewId).urls.push(row.url);
  }
  const allPhotoReviews = Array.from(photoMap.values());

  const formatted = {
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    categoryKey: p.category_key,
    price: p.price,
    originalPrice: p.original_price,
    rating: actualRating,
    reviewCount: actualReviewCount,
    recommendCount: p.recommend_count,
    thumbnail: p.thumbnail,
    aiSentiment: { positive, negative },
    aiSummary: {
      pros: p.ai_pros,
      cons: p.ai_cons,
      conclusion: p.ai_conclusion,
    },
    aiAnalyzed: !!p.ai_analyzed_at,
    keywords: keywordsWithSentences,
    photoReviews: allPhotoReviews,
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

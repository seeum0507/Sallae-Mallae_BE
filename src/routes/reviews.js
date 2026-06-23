const express = require("express");
const router = express.Router();
const db = require("../database");
const authMiddleware = require("../middleware/auth");
const { optionalAuthMiddleware } = require("../middleware/auth");
const { runAIAnalysis } = require("../services/aiAnalysis");

// 리뷰 목록 (이미지 포함, 정렬 지원)
router.get("/product/:productId", optionalAuthMiddleware, (req, res) => {
  const { sort = "helpful" } = req.query;

  const sortMap = {
    helpful: "r.helpful DESC",
    latest: "r.date DESC",
    rating_high: "r.rating DESC",
    rating_low: "r.rating ASC",
  };

  const orderBy = sortMap[sort] || "r.helpful DESC";

  const reviews = db
    .prepare(
      `SELECT r.* FROM reviews r WHERE r.product_id = ? ORDER BY ${orderBy}`
    )
    .all(req.params.productId);

  res.json(reviews.map((r) => formatReview(r, req.user?.id)));
});

// 리뷰 작성 (로그인 필요)
router.post("/", authMiddleware, async (req, res) => {
  const { productId, rating, content, images = [] } = req.body;
  const { id: userId, nickname: author } = req.user;

  if (!productId || !rating || !content) {
    return res.status(400).json({ error: "모든 필드를 입력해주세요." });
  }
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: "별점은 1~5 사이여야 합니다." });
  }

  const id = `r_${Date.now()}`;
  const initial = author.charAt(0);
  const colors = [
    "bg-blue-100 text-blue-600",
    "bg-purple-100 text-purple-600",
    "bg-green-100 text-green-600",
    "bg-yellow-100 text-yellow-600",
    "bg-pink-100 text-pink-600",
  ];
  const avatarColor = colors[Math.floor(Math.random() * colors.length)];
  const date = new Date()
    .toLocaleDateString("ko-KR")
    .replace(/\.\s/g, ".")
    .replace(/\.$/, "");

  const insertReview = db.prepare(`
    INSERT INTO reviews (id, product_id, user_id, author, initial, avatar_color, date, rating, content, helpful, replies)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
  `);

  const insertImage = db.prepare(
    "INSERT INTO review_images (review_id, url) VALUES (?, ?)"
  );

  const insertAll = db.transaction(() => {
    insertReview.run(
      id,
      productId,
      userId,
      author,
      initial,
      avatarColor,
      date,
      rating,
      content
    );
    if (Array.isArray(images)) {
      for (const url of images) {
        if (url && typeof url === "string") {
          insertImage.run(id, url);
        }
      }
    }
  });

  insertAll();

  db.prepare(
    "UPDATE products SET review_count = review_count + 1 WHERE id = ?"
  ).run(productId);

  res.status(201).json({ success: true, id });

  runAIAnalysis(productId).catch((err) =>
    console.error("백그라운드 AI 분석 실패:", err.message)
  );
});

// 도움이 돼요 +1 — 로그인 필요, 중복 방지
router.patch("/:id/helpful", authMiddleware, (req, res) => {
  const review = db
    .prepare("SELECT * FROM reviews WHERE id = ?")
    .get(req.params.id);

  if (!review) {
    return res.status(404).json({ error: "리뷰를 찾을 수 없습니다." });
  }

  const existing = db
    .prepare(
      "SELECT id FROM review_helpful WHERE review_id = ? AND user_id = ?"
    )
    .get(req.params.id, req.user.id);

  if (existing) {
    return res.json({ success: true, helpful: review.helpful, liked: true });
  }

  const runBoth = db.transaction(() => {
    db.prepare(
      "INSERT INTO review_helpful (review_id, user_id) VALUES (?, ?)"
    ).run(req.params.id, req.user.id);
    db.prepare("UPDATE reviews SET helpful = helpful + 1 WHERE id = ?").run(
      req.params.id
    );
  });
  runBoth();

  res.json({ success: true, helpful: review.helpful + 1, liked: true });
});

// 댓글 목록 조회
router.get("/:id/comments", (req, res) => {
  const comments = db
    .prepare(
      "SELECT * FROM comments WHERE review_id = ? ORDER BY created_at ASC"
    )
    .all(req.params.id);

  res.json(
    comments.map((c) => ({
      id: c.id,
      reviewId: c.review_id,
      author: c.author,
      initial: c.initial,
      avatarColor: c.avatar_color,
      content: c.content,
      createdAt: c.created_at,
    }))
  );
});

// 댓글 작성 (로그인 필요)
router.post("/:id/comments", authMiddleware, (req, res) => {
  const { content } = req.body;
  const { id: userId, nickname: author } = req.user;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: "댓글 내용을 입력해주세요." });
  }

  const review = db
    .prepare("SELECT id FROM reviews WHERE id = ?")
    .get(req.params.id);
  if (!review) {
    return res.status(404).json({ error: "리뷰를 찾을 수 없습니다." });
  }

  const initial = author.charAt(0);
  const colors = [
    "bg-blue-100 text-blue-600",
    "bg-purple-100 text-purple-600",
    "bg-green-100 text-green-600",
    "bg-yellow-100 text-yellow-600",
    "bg-pink-100 text-pink-600",
  ];
  const avatarColor = colors[Math.floor(Math.random() * colors.length)];

  const result = db
    .prepare(
      "INSERT INTO comments (review_id, user_id, author, initial, avatar_color, content) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(req.params.id, userId, author, initial, avatarColor, content.trim());

  db.prepare("UPDATE reviews SET replies = replies + 1 WHERE id = ?").run(
    req.params.id
  );

  res.status(201).json({
    id: result.lastInsertRowid,
    reviewId: req.params.id,
    author,
    initial,
    avatarColor,
    content: content.trim(),
    createdAt: new Date().toISOString(),
  });
});

function formatReview(r, currentUserId) {
  const images = db
    .prepare("SELECT url FROM review_images WHERE review_id = ?")
    .all(r.id)
    .map((i) => i.url);

  let likedByMe = false;
  if (currentUserId) {
    const liked = db
      .prepare(
        "SELECT id FROM review_helpful WHERE review_id = ? AND user_id = ?"
      )
      .get(r.id, currentUserId);
    likedByMe = !!liked;
  }

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
    likedByMe,
  };
}

module.exports = router;

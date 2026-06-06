const express = require("express");
const router = express.Router();
const db = require("../database");
const authMiddleware = require("../middleware/auth");

// 리뷰 목록 (이미지 포함)
router.get("/product/:productId", (req, res) => {
  const { sort = "helpful" } = req.query;

  const sortMap = {
    helpful: "helpful DESC",
    latest: "date DESC",
    rating_high: "rating DESC",
    rating_low: "rating ASC",
  };

  const orderBy = sortMap[sort] || "helpful DESC";

  const reviews = db
    .prepare(`SELECT * FROM reviews WHERE product_id = ? ORDER BY ${orderBy}`)
    .all(req.params.productId);

  res.json(reviews.map((r) => formatReview(r)));
});

// 리뷰 작성 (로그인 필요, 이미지 URL 배열 포함)
router.post("/", authMiddleware, (req, res) => {
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
    // images 배열에서 유효한 URL만 저장
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
});

// 도움이 돼요 +1
router.patch("/:id/helpful", (req, res) => {
  const review = db
    .prepare("SELECT * FROM reviews WHERE id = ?")
    .get(req.params.id);

  if (!review) {
    return res.status(404).json({ error: "리뷰를 찾을 수 없습니다." });
  }

  db.prepare("UPDATE reviews SET helpful = helpful + 1 WHERE id = ?").run(
    req.params.id
  );

  res.json({ success: true, helpful: review.helpful + 1 });
});

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

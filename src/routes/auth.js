const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../database");
const authMiddleware = require("../middleware/auth");

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, nickname: user.nickname },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// 회원가입
router.post("/signup", async (req, res) => {
  const { nickname, email, password } = req.body;

  if (!nickname || !email || !password) {
    return res.status(400).json({ error: "모든 필드를 입력해주세요." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "비밀번호는 8자 이상이어야 합니다." });
  }

  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(email);
  if (existing) {
    return res.status(409).json({ error: "이미 사용 중인 이메일입니다." });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const result = db
    .prepare("INSERT INTO users (nickname, email, password) VALUES (?, ?, ?)")
    .run(nickname, email, hashedPassword);

  const user = { id: result.lastInsertRowid, email, nickname };
  const token = generateToken(user);

  res.status(201).json({ token, user: { id: user.id, email, nickname } });
});

// 로그인
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "이메일과 비밀번호를 입력해주세요." });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user) {
    return res
      .status(401)
      .json({ error: "이메일 또는 비밀번호가 틀렸습니다." });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res
      .status(401)
      .json({ error: "이메일 또는 비밀번호가 틀렸습니다." });
  }

  const token = generateToken(user);
  res.json({
    token,
    user: { id: user.id, email: user.email, nickname: user.nickname },
  });
});

// 내 정보 조회 (리뷰 목록 + 찜한 상품 ID 포함)
router.get("/me", authMiddleware, (req, res) => {
  const user = db
    .prepare("SELECT id, nickname, email, created_at FROM users WHERE id = ?")
    .get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: "사용자를 찾을 수 없습니다." });
  }

  const reviewCount = db
    .prepare("SELECT COUNT(*) as cnt FROM reviews WHERE user_id = ?")
    .get(req.user.id);

  // 내가 쓴 리뷰 목록 (상품명 포함)
  const myReviews = db
    .prepare(
      `
      SELECT r.id, r.product_id, r.rating, r.content, r.date, r.helpful,
             p.name as product_name, p.thumbnail as product_thumbnail
      FROM reviews r
      JOIN products p ON r.product_id = p.id
      WHERE r.user_id = ?
      ORDER BY r.date DESC
    `
    )
    .all(req.user.id);

  // 찜한 상품 ID 목록
  const likedProductIds = db
    .prepare("SELECT product_id FROM likes WHERE user_id = ?")
    .all(req.user.id)
    .map((l) => l.product_id);

  res.json({
    ...user,
    reviewCount: reviewCount?.cnt || 0,
    myReviews: myReviews.map((r) => ({
      id: r.id,
      productId: r.product_id,
      productName: r.product_name,
      productThumbnail: r.product_thumbnail,
      rating: r.rating,
      content: r.content,
      date: r.date,
      helpful: r.helpful,
    })),
    likedProductIds,
  });
});

// 비밀번호 변경
router.patch("/password", authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "모든 필드를 입력해주세요." });
  }
  if (newPassword.length < 8) {
    return res
      .status(400)
      .json({ error: "새 비밀번호는 8자 이상이어야 합니다." });
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  const isMatch = await bcrypt.compare(currentPassword, user.password);

  if (!isMatch) {
    return res.status(401).json({ error: "현재 비밀번호가 틀렸습니다." });
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  db.prepare("UPDATE users SET password = ? WHERE id = ?").run(
    hashed,
    req.user.id
  );

  res.json({ success: true });
});

module.exports = router;

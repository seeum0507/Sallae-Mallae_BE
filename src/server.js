require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const authRouter = require("./routes/auth");
const productsRouter = require("./routes/products");
const reviewsRouter = require("./routes/reviews");
const aiRouter = require("./routes/ai");

const app = express();
const PORT = process.env.PORT || 3001;

// 업로드 폴더 생성
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("이미지 파일만 업로드 가능합니다."));
  },
});

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// 업로드된 이미지 정적 서빙
app.use("/uploads", express.static(uploadDir));

// 이미지 업로드 엔드포인트 (최대 5장)
app.post("/api/upload", upload.array("images", 5), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "파일이 없습니다." });
  }
  const urls = req.files.map(
    (f) => `http://localhost:${PORT}/uploads/${f.filename}`
  );
  res.json({ urls });
});

app.use("/api/auth", authRouter);
app.use("/api/products", productsRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/ai", aiRouter);

app.get("/", (req, res) => {
  res.json({ message: "살래말래? 서버 작동 중 ✅" });
});

app.listen(PORT, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
});

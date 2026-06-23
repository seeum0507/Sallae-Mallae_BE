const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "../data.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    category TEXT NOT NULL,
    category_key TEXT NOT NULL,
    price INTEGER NOT NULL,
    original_price INTEGER NOT NULL,
    rating REAL NOT NULL,
    review_count INTEGER NOT NULL,
    recommend_count INTEGER NOT NULL,
    thumbnail TEXT NOT NULL,
    ai_positive INTEGER DEFAULT 0,
    ai_negative INTEGER DEFAULT 0,
    ai_pros TEXT DEFAULT '',
    ai_cons TEXT DEFAULT '',
    ai_conclusion TEXT DEFAULT '',
    ai_analyzed_at TEXT DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    user_id INTEGER,
    author TEXT NOT NULL,
    initial TEXT NOT NULL,
    avatar_color TEXT NOT NULL,
    date TEXT NOT NULL,
    rating INTEGER NOT NULL,
    content TEXT NOT NULL,
    helpful INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS review_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id TEXT NOT NULL,
    url TEXT NOT NULL,
    FOREIGN KEY (review_id) REFERENCES reviews(id)
  );

  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id TEXT NOT NULL,
    UNIQUE(user_id, product_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS keywords (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    label TEXT NOT NULL,
    count INTEGER DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS keyword_sentences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword_id TEXT NOT NULL,
    sentence TEXT NOT NULL,
    FOREIGN KEY (keyword_id) REFERENCES keywords(id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    author TEXT NOT NULL,
    initial TEXT NOT NULL,
    avatar_color TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (review_id) REFERENCES reviews(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS photo_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    url TEXT NOT NULL,
    rating INTEGER NOT NULL,
    likes INTEGER DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS review_helpful (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(review_id, user_id),
    FOREIGN KEY (review_id) REFERENCES reviews(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

try {
  db.exec(`ALTER TABLE products ADD COLUMN ai_analyzed_at TEXT DEFAULT NULL`);
} catch (e) {}

function seedData() {
  const count = db.prepare("SELECT COUNT(*) as cnt FROM products").get();
  if (count.cnt > 0) return;

  const products = [
    {
      id: "wm-001",
      name: "컴팩트 미니 세탁기 3.5kg",
      brand: "자취라이프",
      category: "가전 · 세탁기",
      category_key: "washing-machine",
      price: 189000,
      original_price: 249000,
      rating: 4.5,
      review_count: 1247,
      recommend_count: 892,
      thumbnail: "svg-washing-machine",
      ai_positive: 0,
      ai_negative: 0,
      ai_pros: "",
      ai_cons: "",
      ai_conclusion: "",
    },
    {
      id: "rc-001",
      name: "1인용 미니 밥솥 1.5인분",
      brand: "쿠쿠",
      category: "가전 · 밥솥",
      category_key: "rice-cooker",
      price: 45000,
      original_price: 59000,
      rating: 4.8,
      review_count: 3421,
      recommend_count: 2105,
      thumbnail:
        "https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?w=600&q=80",
      ai_positive: 0,
      ai_negative: 0,
      ai_pros: "",
      ai_cons: "",
      ai_conclusion: "",
    },
    {
      id: "vc-001",
      name: "무선 핸디 청소기 초경량",
      brand: "샤오미",
      category: "가전 · 청소기",
      category_key: "vacuum",
      price: 39900,
      original_price: 45000,
      rating: 4.6,
      review_count: 2156,
      recommend_count: 1540,
      thumbnail:
        "https://images.unsplash.com/photo-1558317374-067fb5f30001?w=600&q=80",
      ai_positive: 0,
      ai_negative: 0,
      ai_pros: "",
      ai_cons: "",
      ai_conclusion: "",
    },
    {
      id: "mw-001",
      name: "플랫 전자레인지 20L",
      brand: "삼성전자",
      category: "가전 · 전자레인지",
      category_key: "microwave",
      price: 89000,
      original_price: 110000,
      rating: 4.9,
      review_count: 5432,
      recommend_count: 4200,
      thumbnail:
        "https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?w=600&q=80",
      ai_positive: 0,
      ai_negative: 0,
      ai_pros: "",
      ai_cons: "",
      ai_conclusion: "",
    },
    {
      id: "af-001",
      name: "올스텐 에어프라이어 3L",
      brand: "보토",
      category: "가전 · 에어프라이어",
      category_key: "air-fryer",
      price: 65000,
      original_price: 89000,
      rating: 4.7,
      review_count: 1890,
      recommend_count: 1200,
      thumbnail:
        "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&q=80",
      ai_positive: 0,
      ai_negative: 0,
      ai_pros: "",
      ai_cons: "",
      ai_conclusion: "",
    },
    {
      id: "hm-001",
      name: "무드등 미니 가습기",
      brand: "오아",
      category: "가전 · 가습기",
      category_key: "humidifier",
      price: 24900,
      original_price: 35000,
      rating: 4.4,
      review_count: 980,
      recommend_count: 650,
      thumbnail:
        "https://images.unsplash.com/photo-1632054010678-7f2e5a1a7355?w=600&q=80",
      ai_positive: 0,
      ai_negative: 0,
      ai_pros: "",
      ai_cons: "",
      ai_conclusion: "",
    },
    {
      id: "ts-001",
      name: "레트로 팝업 토스터기",
      brand: "스메그스타일",
      category: "가전 · 토스터",
      category_key: "toaster",
      price: 32000,
      original_price: 45000,
      rating: 4.6,
      review_count: 750,
      recommend_count: 520,
      thumbnail:
        "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=600&q=80",
      ai_positive: 0,
      ai_negative: 0,
      ai_pros: "",
      ai_cons: "",
      ai_conclusion: "",
    },
    {
      id: "cm-001",
      name: "캡슐 커피머신 미니",
      brand: "네스프레소",
      category: "가전 · 커피머신",
      category_key: "coffee",
      price: 129000,
      original_price: 159000,
      rating: 4.9,
      review_count: 4210,
      recommend_count: 3800,
      thumbnail:
        "https://images.unsplash.com/photo-1517701550927-30cfcbef5fac?w=600&q=80",
      ai_positive: 0,
      ai_negative: 0,
      ai_pros: "",
      ai_cons: "",
      ai_conclusion: "",
    },
  ];

  const insertProduct = db.prepare(`
    INSERT INTO products (
      id, name, brand, category, category_key,
      price, original_price, rating, review_count, recommend_count,
      thumbnail, ai_positive, ai_negative, ai_pros, ai_cons, ai_conclusion
    ) VALUES (
      @id, @name, @brand, @category, @category_key,
      @price, @original_price, @rating, @review_count, @recommend_count,
      @thumbnail, @ai_positive, @ai_negative, @ai_pros, @ai_cons, @ai_conclusion
    )
  `);

  const insertReview = db.prepare(`
    INSERT INTO reviews (id, product_id, user_id, author, initial, avatar_color, date, rating, content, helpful, replies)
    VALUES (@id, @product_id, @user_id, @author, @initial, @avatar_color, @date, @rating, @content, @helpful, @replies)
  `);

  // ✅ 변경: photo_reviews 테이블 대신, 기존 리뷰(r1, r2, r3, r6)에
  //    review_images로 사진을 연결. 이렇게 해야 전체 리뷰 목록 / 포토리뷰
  //    양쪽에서 author/date/content가 함께 자동으로 노출됨.
  const insertReviewImage = db.prepare(`
    INSERT INTO review_images (review_id, url) VALUES (@review_id, @url)
  `);

  const insertAll = db.transaction(() => {
    for (const p of products) insertProduct.run(p);

    const reviews = [
      {
        id: "r1",
        product_id: "wm-001",
        user_id: null,
        author: "자취 3년차 민지",
        initial: "민",
        avatar_color: "bg-blue-100 text-blue-600",
        date: "2023.10.15",
        rating: 5,
        content:
          "원룸에 살아서 큰 세탁기는 부담스러웠는데 사이즈가 딱이에요! 소음도 적어서 퇴근하고 밤에 돌려도 눈치 안 보입니다.",
        helpful: 24, // ✅ 기존 photo_reviews의 likes(24) 값을 helpful로 이전
        replies: 0,
      },
      {
        id: "r2",
        product_id: "wm-001",
        user_id: null,
        author: "원룸러버",
        initial: "원",
        avatar_color: "bg-purple-100 text-purple-600",
        date: "2023.10.12",
        rating: 4,
        content:
          "디자인이 깔끔해서 화장실 구석에 둬도 예뻐요. 다만 용량이 작아서 이불 빨래는 코인세탁소 가야하는게 조금 아쉽네요.",
        helpful: 12, // ✅ 기존 likes(12) 이전
        replies: 0,
      },
      {
        id: "r3",
        product_id: "rc-001",
        user_id: null,
        author: "밥심으로산다",
        initial: "밥",
        avatar_color: "bg-yellow-100 text-yellow-600",
        date: "2023.11.02",
        rating: 5,
        content:
          "맨날 배달 시켜먹다가 식비 아끼려고 샀는데 대만족입니다. 딱 한두 끼 먹을 양만 할 수 있어서 밥이 남아서 버릴 일이 없어요.",
        helpful: 45, // ✅ 기존 likes(45) 이전
        replies: 0,
      },
      {
        id: "r4",
        product_id: "rc-001",
        user_id: null,
        author: "자취초보",
        initial: "자",
        avatar_color: "bg-green-100 text-green-600",
        date: "2023.10.28",
        rating: 4,
        content:
          "디자인도 귀엽고 밥도 잘 됩니다. 다만 보온을 하루 이상 하면 밥이 좀 마르는 경향이 있어서 그때그때 해먹는게 좋아요.",
        helpful: 0,
        replies: 0,
      },
      {
        id: "r5",
        product_id: "vc-001",
        user_id: null,
        author: "머리숱부자",
        initial: "머",
        avatar_color: "bg-pink-100 text-pink-600",
        date: "2023.11.10",
        rating: 5,
        content:
          "방바닥에 굴러다니는 머리카락 치우는 용도로 샀는데 진짜 편해요.",
        helpful: 0,
        replies: 0,
      },
      {
        id: "r6",
        product_id: "mw-001",
        user_id: null,
        author: "편도매니아",
        initial: "편",
        avatar_color: "bg-orange-100 text-orange-600",
        date: "2023.11.15",
        rating: 5,
        content:
          "회전판 있는거 쓰다가 넘어왔는데 진짜 편합니다. 청소도 물티슈로 쓱 닦으면 끝입니다.",
        helpful: 89, // ✅ 기존 likes(89) 이전
        replies: 0,
      },
      {
        id: "r7",
        product_id: "af-001",
        user_id: null,
        author: "냉동인간",
        initial: "냉",
        avatar_color: "bg-blue-100 text-blue-600",
        date: "2023.11.18",
        rating: 5,
        content:
          "에어프라이어는 자취생한테 진짜 혁명입니다. 남은 치킨 데워먹을 때, 냉동 만두 구울 때 최고예요.",
        helpful: 0,
        replies: 0,
      },
      {
        id: "r8",
        product_id: "cm-001",
        user_id: null,
        author: "홈카페마스터",
        initial: "홈",
        avatar_color: "bg-orange-100 text-orange-600",
        date: "2023.11.25",
        rating: 5,
        content:
          "매일 아침 커피 수혈하는데 카페 가는 돈 아끼려고 샀어요. 크레마도 풍부하고 너무 맛있어요.",
        helpful: 0,
        replies: 0,
      },
    ];
    for (const r of reviews) insertReview.run(r);

    // ✅ 변경: photos 배열 → photoImages 배열 (review_id로 기존 리뷰와 연결)
    const photoImages = [
      {
        review_id: "r1",
        url: "https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=400&q=80",
      },
      {
        review_id: "r2",
        url: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&q=80",
      },
      {
        review_id: "r3",
        url: "https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?w=400&q=80",
      },
      {
        review_id: "r6",
        url: "https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?w=400&q=80",
      },
    ];
    for (const img of photoImages) insertReviewImage.run(img);
  });

  insertAll();
  console.log("✅ 초기 데이터 삽입 완료 (AI 분석은 아직 비어있음)");
}

seedData();

async function runInitialAnalysis() {
  const { runAIAnalysis } = require("./services/aiAnalysis");

  const unanalyzedProducts = db
    .prepare(
      `SELECT p.id FROM products p
       WHERE p.ai_analyzed_at IS NULL
       AND EXISTS (SELECT 1 FROM reviews r WHERE r.product_id = p.id)`
    )
    .all();

  if (unanalyzedProducts.length === 0) return;

  console.log(
    `🤖 초기 AI 분석 대상 상품 ${unanalyzedProducts.length}개 발견, 분석을 시작합니다...`
  );

  for (const p of unanalyzedProducts) {
    try {
      await runAIAnalysis(p.id);
      console.log(`  ✅ ${p.id} 분석 완료`);
    } catch (err) {
      console.error(`  ❌ ${p.id} 분석 실패:`, err.message);
    }
  }
  console.log("🤖 초기 AI 분석 완료");
}

setImmediate(() => {
  runInitialAnalysis().catch((err) =>
    console.error("초기 AI 분석 중 오류:", err)
  );
});

module.exports = db;

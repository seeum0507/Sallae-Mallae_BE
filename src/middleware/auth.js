const jwt = require("jsonwebtoken");

module.exports = function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "로그인이 필요합니다." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "토큰이 유효하지 않습니다." });
  }
};

// ✅ 추가: 토큰이 있으면 req.user를 채우고, 없거나 유효하지 않아도 막지 않음
// (비로그인 사용자도 리뷰 목록은 볼 수 있어야 하므로, "내가 눌렀는지" 표시만
//  로그인한 경우에 한해 채워주기 위해 사용)
module.exports.optionalAuthMiddleware = function (req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch (err) {
    req.user = null;
  }
  next();
};

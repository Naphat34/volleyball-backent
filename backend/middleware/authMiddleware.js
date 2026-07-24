const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET_KEY = process.env.JWT_SECRET || 'mySuperSecretKey123'; // ควรย้ายไปไว้ใน .env

// 1. เช็คว่า Login หรือยัง (Verify Token)
exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access Denied: No Token Provided' });
  }
  const token = authHeader && authHeader.split(' ')[1]; // แยก Token ออกจาก "Bearer "

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid Token' });
  }
};

// 2. เช็คว่าเป็น Admin ไหม
exports.isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin Only' });
  }
  next();
};

exports.hasAnyRole = (allowedRoles = []) => (req, res, next) => {
  const role = req.user?.role;
  if (!allowedRoles.includes(role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

exports.isScorerOrAdmin = exports.hasAnyRole(['admin', 'score', 'scorer']);

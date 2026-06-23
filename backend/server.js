console.log("🔥 VERSION 2 DEPLOYED");
const cors = require('cors');
const express = require('express');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const apiRoutes = require('./routes/api');
const scorerRoutes = require('./routes/scorerRoutes');
const adminRoutes = require('./routes/adminRoutes');


const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. Setup Middleware FIRST
// ==========================================
const allowedOrigins = [
  "http://localhost:5173",
  "https://volleyplg.unaux.com"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const normalizedOrigin = origin.replace(/\/$/, "");
    const origins = [...allowedOrigins];
    if (process.env.FRONTEND_URL) {
      origins.push(process.env.FRONTEND_URL.replace(/\/$/, ""));
    }
    
    if (origins.includes(normalizedOrigin) || origins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
}));
app.use(cookieParser());

// These parsers must run BEFORE the routes so req.body exists
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// ==========================================
// 2. Setup Routes SECOND
// ==========================================
app.use('/api/scorer', scorerRoutes);
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);


// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 API Endpoint: http://localhost:${PORT}/api`);
});
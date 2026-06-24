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

// ==========================================
// 3. Socket.io Integration
// ==========================================
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
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
  }
});

function updateAndEmitStatus(io, matchId) {
  const roomName = `match_${matchId}`;
  const clients = io.sockets.adapter.rooms.get(roomName) || new Set();
  
  let homeConnected = false;
  let awayConnected = false;
  let scorerConnected = false;
  
  for (const clientId of clients) {
    const clientSocket = io.sockets.sockets.get(clientId);
    if (clientSocket) {
      if (clientSocket.role === 'scorer') {
        scorerConnected = true;
      } else if (clientSocket.role === 'staff') {
        if (clientSocket.side === 'home') homeConnected = true;
        if (clientSocket.side === 'away') awayConnected = true;
      }
    }
  }
  
  io.to(roomName).emit('connection_status_update', {
    staff: {
      home: homeConnected,
      away: awayConnected
    },
    scorer: scorerConnected
  });
}

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);
  
  socket.on('join_match', ({ matchId, role, side }) => {
    socket.join(`match_${matchId}`);
    socket.matchId = matchId;
    socket.role = role;
    socket.side = side;
    console.log(`👤 Socket ${socket.id} joined room match_${matchId} as ${role} (${side || 'N/A'})`);
    
    updateAndEmitStatus(io, matchId);
  });
  
  socket.on('disconnect', () => {
    console.log(`❌ Socket disconnected: ${socket.id}`);
    if (socket.matchId) {
      updateAndEmitStatus(io, socket.matchId);
    }
  });
});

app.set('io', io);

// Database Migrations (Run once on startup)
const db = require('./config/db');
db.query(`
  ALTER TABLE matches ADD COLUMN IF NOT EXISTS max_sets INTEGER DEFAULT 5;
  ALTER TABLE competitions DROP COLUMN IF EXISTS max_sets;
`).then(() => {
  console.log("✅ Database schema migration: max_sets column verified on matches table, dropped from competitions table.");
}).catch(err => {
  console.error("❌ Database schema migration failed:", err);
});

// Start Server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 API Endpoint: http://localhost:${PORT}/api`);
});
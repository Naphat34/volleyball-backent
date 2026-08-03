const cors = require('cors');
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const apiRoutes = require('./routes/api');
const scorerRoutes = require('./routes/scorerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { createCorsOptions } = require('./config/security');
const { rejectCrossOriginMutations, securityHeaders } = require('./config/security');
const jwt = require('jsonwebtoken');
const db = require('./config/db');
const { getJwtSecret } = require('./config/security');
const { roleHasPermission } = require('./config/permissions');
const { createSocketMonitor } = require('./utils/socketMonitor');


const app = express();
const PORT = process.env.PORT || 3000;
const uploadsDir = path.join(__dirname, 'uploads');


// ==========================================
// 1. Setup Middleware FIRST
// ==========================================
const corsOptions = createCorsOptions();
const socketMonitor = createSocketMonitor();
const SECRET_KEY = getJwtSecret();

app.use(cors(corsOptions));
app.use(securityHeaders);
app.use(rejectCrossOriginMutations);
app.use(cookieParser());
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', process.env.TRUST_PROXY);
}
app.set('socketMonitor', socketMonitor);

// These parsers must run BEFORE the routes so req.body exists
app.use(express.json({ limit: '5mb' })); 
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use('/uploads', express.static(uploadsDir));

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

function createSocketIo(server) {
  const io = new Server(server, {
    cors: corsOptions
  });

  const parseCookies = (cookieHeader = '') => Object.fromEntries(
    String(cookieHeader)
      .split(';')
      .map((part) => part.trim().split('='))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)])
  );

  const getSocketUser = async (socket) => {
    const authToken = socket.handshake.auth?.token;
    const bearer = socket.handshake.headers.authorization;
    const cookies = parseCookies(socket.handshake.headers.cookie);
    const token = authToken || (bearer?.startsWith('Bearer ') ? bearer.slice(7) : null) || cookies.token;
    if (!token) return null;

    const decoded = jwt.verify(token, SECRET_KEY);
    const result = await db.query('SELECT id, role, status, team_id FROM users WHERE id = ?', [decoded.id]);
    const user = result.rows[0];
    if (!user || !['approved', 'active'].includes(String(user.status || '').toLowerCase())) return null;
    return user;
  };

  const canJoinMatchRoom = async ({ socket, matchId, role, side }) => {
    if (!matchId || !/^\d+$/.test(String(matchId))) return false;
    if (!['viewer', 'referee', 'staff', 'scorer'].includes(String(role || 'viewer'))) return false;
    if (role === 'viewer' || role === 'referee') return true;

    const user = socket.user || await getSocketUser(socket);
    if (!user) return false;
    socket.user = user;

    if (role === 'scorer') return roleHasPermission(user.role, 'match.score');
    if (role !== 'staff' || !user.team_id || !['home', 'away'].includes(side)) return false;

    const matchResult = await db.query('SELECT home_team_id, away_team_id FROM matches WHERE id = ?', [matchId]);
    const match = matchResult.rows[0];
    if (!match) return false;
    const expectedTeamId = side === 'home' ? match.home_team_id : match.away_team_id;
    return String(expectedTeamId) === String(user.team_id);
  };

  io.on('connection', (socket) => {
    socketMonitor.onConnect(socket);
    console.log(`🔌 Socket connected: ${socket.id}`);
    
    socket.on('join_match', async ({ matchId, role = 'viewer', side }) => {
      const allowed = await canJoinMatchRoom({ socket, matchId, role, side });
      if (!allowed) {
        socket.emit('join_error', { error: 'Not authorized to join this match room' });
        return;
      }
      socket.join(`match_${matchId}`);
      socket.matchId = matchId;
      socket.role = role;
      socket.side = side;
      socketMonitor.onJoin(socket, matchId, role, side);
      console.log(`👤 Socket ${socket.id} joined room match_${matchId} as ${role} (${side || 'N/A'})`);
      
      updateAndEmitStatus(io, matchId);
    });
    
    socket.on('disconnect', () => {
      socketMonitor.onDisconnect(socket);
      console.log(`❌ Socket disconnected: ${socket.id}`);
      if (socket.matchId) {
        updateAndEmitStatus(io, socket.matchId);
      }
    });
  });

  return io;
}

function startServer(port) {
  const server = http.createServer(app);
  const io = createSocketIo(server);
  app.set('io', io);

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      console.warn(`⚠️ Port ${port} is already in use. Trying ${nextPort}...`);
      startServer(nextPort);
      return;
    }

    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
    console.log(`🔗 API Endpoint: http://localhost:${port}/api`);
  });
}

startServer(Number(process.env.PORT || 3000));

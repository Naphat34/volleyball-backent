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
const { canJoinStaffRoom } = require('./controllers/courtStationController');
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
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use('/uploads', express.static(uploadsDir));

app.get('/api/debug/uploads', require('./middleware/authMiddleware').verifyApprovedToken, require('./middleware/authMiddleware').isAdmin, (req, res) => {
  const fs = require('fs');

  try {
    const exists = fs.existsSync(uploadsDir);

    const files = exists
      ? fs.readdirSync(uploadsDir)
      : [];

    res.json({
      __dirname,
      uploadsDir,
      exists,
      files
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

// ==========================================
// 2. Setup Routes SECOND
// ==========================================
app.post('/api/public-identifiers', require('./middleware/rateLimiter')({ windowMs: 60000, max: 300, keyPrefix: 'public-identifiers' }), require('./controllers/publicIdentifierController').resolve);
app.use('/api', require('./middleware/publicUrl').publicUrl());
app.use('/api', require('./middleware/accessBoundary').boundary);
app.use('/api/competition-workflows', require('./routes/competitionWorkflowRoutes'));
app.use('/api/access', require('./routes/accessRoutes'));
app.use('/api', require('./middleware/manualScorerAccess'));
app.use('/api/vis-custom', require('./routes/customVisRoutes'));
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
    const result = await db.query('SELECT id, role, status, team_id, authorization_version FROM users WHERE id = ?', [decoded.id]);
    const user = result.rows[0];
    if (user) user.role=require('./config/permissions').normalizeRole(user.role);
    if (!user || String(user.status || '').trim().toLowerCase() !== 'active') return null;
    if(Number(decoded.authorization_version)!==Number(user.authorization_version))return null;
    return require('./utils/accessScope').loadCapabilities(db,user);
  };

  const canJoinMatchRoom = async ({ socket, matchId, role, side, stationToken }) => {
    if (/^custom-[a-f0-9-]{36}$/i.test(String(matchId)) && role === 'viewer') {
      try {
        const user = await getSocketUser(socket);
        if (!user || !roleHasPermission(user.role, 'vims.record')) return false;
        const result = await db.query('SELECT owner_id,competition_id FROM custom_vis_matches WHERE id = ?', [matchId]);
        if(!result.rows[0]||String(result.rows[0].owner_id)!==String(user.id))return false;
        if(result.rows[0].competition_id)await require('./utils/accessScope').assertCompetition(db,user,result.rows[0].competition_id);
        return true;
      } catch { return false; }
    }
    if (!matchId || !/^\d+$/.test(String(matchId))) return false;
    if (!['viewer', 'referee', 'referee_alerts', 'staff', 'scorer'].includes(String(role || 'viewer'))) return false;
    const manual = (await db.query('SELECT competition_id, manual_owner_id, manual_published, manual_lifecycle, manual_vis_shared, status FROM matches WHERE id=?', [matchId])).rows[0];
    if (role === 'referee_alerts') {
      if (!manual || (manual.manual_owner_id && (!Number(manual.manual_published) || manual.manual_lifecycle === 'draft'))) return false;
      try {
        const user = await getSocketUser(socket);
        if (user?.role !== 'referee' || !roleHasPermission(user.role, 'match.view')) return false;
        await require('./utils/accessScope').assertCompetition(db, user, manual.competition_id);
        socket.user = user;
        return true;
      } catch { return false; }
    }
    if (manual?.manual_owner_id) {
      let user;
      try { user = await getSocketUser(socket); } catch { user = null; }
      const owner = user && (user.role === 'super_admin' || String(user.id) === String(manual.manual_owner_id)) && roleHasPermission(user.role, 'match.score');
      const statisticsReader = ['viewer', 'scorer'].includes(role) && require('./utils/manualVisAccess').canReadStatistics(user, manual);
      if(statisticsReader&&manual.competition_id){
        try{await require('./utils/accessScope').assertCompetition(db,user,manual.competition_id);}catch{return false;}
      }
      if (!owner && !statisticsReader && !(role === 'viewer' && manual.manual_published && manual.manual_lifecycle !== 'draft')) return false;
      if (user) socket.user = user;
    }
    if (role === 'viewer' || role === 'referee') return true;

    const user = await getSocketUser(socket);
    if (!user) return false;
    socket.user = user;

    if (role === 'scorer') {
      if (!roleHasPermission(user.role,'score.record')) return false;
      try { await require('./utils/accessScope').assertMatch(db,user,'match',matchId,'score.record',{draftOwner:true}); return true; }
      catch { return false; }
    }
    if (role !== 'staff' || !roleHasPermission(user.role,'match.request') || !user.team_id || !['home', 'away'].includes(side)) return false;

    const matchResult = await db.query('SELECT home_team_id, away_team_id FROM matches WHERE id = ?', [matchId]);
    const match = matchResult.rows[0];
    if (!match) return false;
    const expectedTeamId = side === 'home' ? match.home_team_id : match.away_team_id;
    if (stationToken) return canJoinStaffRoom(matchId, user, stationToken, expectedTeamId);
    return String(expectedTeamId) === String(user.team_id);
  };

  const baseTo=io.to.bind(io);
  io.to=room=>{
    const target=baseTo(room),emit=target.emit;
    target.emit=function(event,...args){
      if(/^match_.*:(score|operations|referee)$/.test(String(room))){
        for(const socketId of io.sockets.adapter.rooms.get(room)||[]){
          const socket=io.sockets.sockets.get(socketId);
          const join = socket?.lastJoin;
          if(join)void canJoinMatchRoom({socket,...join}).then(allowed=>{
            if (socket.lastJoin !== join || !socket.rooms.has(room)) return;
            if(allowed)socket.emit(event,...args);else socket.leave(room);
          }).catch(()=>{ if (socket.lastJoin === join) socket.leave(room); });
        }
        return true;
      }
      return emit.call(this,event,...(/^match_[^:]+$/.test(String(room))?args.map(require('./middleware/accessBoundary').publicProjection):args));
    };
    return target;
  };
  io.on('connection', (socket) => {
    let checking=false;
    const revalidate=setInterval(async()=>{
      if(checking||!socket.lastJoin)return;checking=true;
      try {
        if(!await canJoinMatchRoom({socket,...socket.lastJoin})){
          for(const room of [...socket.rooms])if(room.startsWith('match_'))socket.leave(room);
          socket.emit('join_error',{error:'Access was revoked; sign in again'});socket.disconnect(true);
        }
      }catch {socket.disconnect(true);}finally{checking=false;}
    },5000);
    revalidate.unref();
    socket.once('disconnect',()=>clearInterval(revalidate));
    socketMonitor.onConnect(socket);
    console.log(`🔌 Socket connected: ${socket.id}`);

    socket.on('join_match', async ({ matchId, role = 'viewer', side, stationToken }, acknowledge) => {
      const allowed = await canJoinMatchRoom({ socket, matchId, role, side, stationToken });
      if (!socket.connected) return;
      if (!allowed) {
        if (typeof acknowledge === 'function') acknowledge({ joined: false, refereeAlerts: false });
        socket.emit('join_error', { error: 'Not authorized to join this match room' });
        return;
      }
      for (const room of [...socket.rooms]) if (room.startsWith('match_')) socket.leave(room);
      socket.join(`match_${matchId}`);
      if(role==='scorer') socket.join(`match_${matchId}:score`);
      if(['scorer','staff'].includes(role))socket.join(`match_${matchId}:operations`);
      if(role==='referee_alerts') socket.join(`match_${matchId}:referee`);
      socket.matchId = matchId;
      socket.role = role;
      socket.side = side;
      socketMonitor.onJoin(socket, matchId, role, side);
      socket.lastJoin={matchId,role,side,stationToken};
      if (typeof acknowledge === 'function') acknowledge({ joined: true, refereeAlerts: role === 'referee_alerts' });
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
      console.error(`Port ${port} is already in use. Use the existing backend or stop it before restarting. The API port must match VITE_API_URL.`);
      process.exit(1);
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

if(require.main===module)startServer(Number(process.env.PORT || 3000));
module.exports={app,createSocketIo,startServer};

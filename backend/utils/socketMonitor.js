function createSocketMonitor() {
  const state = {
    connected: 0,
    totalConnections: 0,
    totalDisconnects: 0,
    totalErrors: 0,
    rooms: {},
    lastError: null,
    lastUpdatedAt: new Date().toISOString(),
  };

  const touch = () => {
    state.lastUpdatedAt = new Date().toISOString();
  };

  return {
    onConnect(socket) {
      state.connected += 1;
      state.totalConnections += 1;
      touch();

      socket.on('error', (err) => {
        state.totalErrors += 1;
        state.lastError = {
          socketId: socket.id,
          message: err?.message || String(err),
          at: new Date().toISOString(),
        };
        touch();
        console.error('Socket error:', state.lastError);
      });
    },

    onJoin(socket, matchId, role, side) {
      const roomName = `match_${matchId}`;
      state.rooms[roomName] = state.rooms[roomName] || {
        matchId: String(matchId),
        connected: 0,
        roles: {},
        sides: {},
      };
      const room = state.rooms[roomName];
      room.connected += 1;
      room.roles[role || 'unknown'] = (room.roles[role || 'unknown'] || 0) + 1;
      if (side) room.sides[side] = (room.sides[side] || 0) + 1;
      socket.monitorRoomName = roomName;
      socket.monitorRole = role || 'unknown';
      socket.monitorSide = side || null;
      touch();
    },

    onDisconnect(socket) {
      state.connected = Math.max(0, state.connected - 1);
      state.totalDisconnects += 1;

      const room = socket.monitorRoomName ? state.rooms[socket.monitorRoomName] : null;
      if (room) {
        room.connected = Math.max(0, room.connected - 1);
        if (socket.monitorRole) {
          room.roles[socket.monitorRole] = Math.max(0, (room.roles[socket.monitorRole] || 0) - 1);
        }
        if (socket.monitorSide) {
          room.sides[socket.monitorSide] = Math.max(0, (room.sides[socket.monitorSide] || 0) - 1);
        }
        if (room.connected === 0) delete state.rooms[socket.monitorRoomName];
      }

      touch();
    },

    snapshot() {
      return JSON.parse(JSON.stringify(state));
    },
  };
}

module.exports = {
  createSocketMonitor,
};

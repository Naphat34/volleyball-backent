const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const { createSocketMonitor } = require('../utils/socketMonitor');

test('socket monitor tracks connection, room joins, disconnects, and errors', () => {
  const monitor = createSocketMonitor();
  const socket = new EventEmitter();
  socket.id = 'socket-1';

  monitor.onConnect(socket);
  monitor.onJoin(socket, 12, 'scorer', null);
  socket.emit('error', new Error('boom'));

  let snapshot = monitor.snapshot();
  assert.equal(snapshot.connected, 1);
  assert.equal(snapshot.totalConnections, 1);
  assert.equal(snapshot.totalErrors, 1);
  assert.equal(snapshot.rooms.match_12.roles.scorer, 1);

  monitor.onDisconnect(socket);
  snapshot = monitor.snapshot();
  assert.equal(snapshot.connected, 0);
  assert.equal(snapshot.totalDisconnects, 1);
  assert.equal(snapshot.rooms.match_12, undefined);
});

const db = require('../config/db');

const MAX_ACTION_LENGTH = 100;
const MAX_ENTITY_LENGTH = 100;

const getRequestIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for'];
  return Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : String(forwardedFor || req.ip || req.socket?.remoteAddress || '').split(',')[0].trim() || null;
};

async function writeAuditLog(req, action, entityType, entityId, details = {}, client = db) {
  try {
    await client.query(
      `INSERT INTO audit_logs
        (user_id, username, role, action, entity_type, entity_id, details, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        req.user?.id || null,
        req.user?.username || null,
        req.user?.role || null,
        String(action || '').slice(0, MAX_ACTION_LENGTH),
        String(entityType || '').slice(0, MAX_ENTITY_LENGTH),
        entityId === undefined || entityId === null ? null : String(entityId),
        JSON.stringify(details || {}),
        getRequestIp(req),
        req.headers['user-agent'] || null,
      ]
    );
  } catch (err) {
    console.error('Audit log write failed:', err);
  }
}

module.exports = {
  writeAuditLog,
};

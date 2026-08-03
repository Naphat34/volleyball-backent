const buckets = new Map();

const getClientKey = (req, keyPrefix) => {
  const ip = String(req.ip || req.socket?.remoteAddress || 'unknown').trim();
  return `${keyPrefix}:${ip}`;
};

const cleanupExpiredBuckets = (now) => {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
};

function rateLimit({ windowMs = 60_000, max = 30, keyPrefix = 'default' } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    cleanupExpiredBuckets(now);

    const key = getClientKey(req, keyPrefix);
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfterSeconds));

    if (bucket.count > max) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
      });
    }

    return next();
  };
}

module.exports = rateLimit;

const DEFAULT_JWT_SECRET = 'development-only-secret-change-me';

const parseCsv = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

/**
 * JWT Secret
 */
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!secret) {
    if (isProduction) {
      throw new Error(
        'JWT_SECRET must be set to a strong non-default value in production'
      );
    }

    console.warn(
      'JWT_SECRET is not set. Using development fallback secret.'
    );

    return DEFAULT_JWT_SECRET;
  }

  if (isProduction && secret.length < 32) {
    throw new Error(
      'JWT_SECRET must be at least 32 characters in production'
    );
  }

  return secret;
}

/**
 * CORS Allowed Origins
 */
function getAllowedOrigins() {
  const configuredOrigins = parseCsv(process.env.CORS_ORIGINS);

  if (configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'CORS_ORIGINS must be configured in production'
    );
  }

  return ['http://localhost:5173'];
}

/**
 * CORS Options
 */
function createCorsOptions() {
  const allowedOrigins = getAllowedOrigins();

  return {
    credentials: true,

    origin(origin, callback) {
      // Allow requests without Origin header
      // e.g. Postman, server-to-server
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error(`Origin ${origin} is not allowed by CORS`)
      );
    },
  };
}

/**
 * Reject cross-origin mutations
 */
function rejectCrossOriginMutations(req, res, next) {
  const unsafeMethods = new Set([
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
  ]);

  if (!unsafeMethods.has(req.method)) {
    return next();
  }

  const origin = req.get('origin');

  if (!origin) {
    return next();
  }

  const allowedOrigins = getAllowedOrigins();

  if (allowedOrigins.includes(origin)) {
    return next();
  }

  return res.status(403).json({
    error: 'Cross-origin request is not allowed',
  });
}

/**
 * Security Headers
 */
function securityHeaders(req, res, next) {
  res.setHeader(
    'X-Content-Type-Options',
    'nosniff'
  );

  res.setHeader(
    'X-Frame-Options',
    'DENY'
  );

  res.setHeader(
    'Referrer-Policy',
    'no-referrer'
  );

  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );

  next();
}

/**
 * Authentication Cookie
 */
function getAuthCookieOptions() {
  const isProduction =
    process.env.NODE_ENV === 'production';

  const sameSite =
    process.env.AUTH_COOKIE_SAMESITE || 'lax';

  return {
    httpOnly: true,

    secure: process.env.AUTH_COOKIE_SECURE
      ? process.env.AUTH_COOKIE_SECURE === 'true'
      : isProduction,

    sameSite,

    maxAge: 2 * 24 * 60 * 60 * 1000,

    path: '/',
  };
}

module.exports = {
  DEFAULT_JWT_SECRET,
  createCorsOptions,
  getAuthCookieOptions,
  getAllowedOrigins,
  getJwtSecret,
  rejectCrossOriginMutations,
  securityHeaders,
};

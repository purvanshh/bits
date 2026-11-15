const rateLimit = require('express-rate-limit');

const int = (v, d) => (parseInt(v, 10) > 0 ? parseInt(v, 10) : d);

// Limiters are created lazily so env vars are read after dotenv has loaded.
const makeApiLimiter = () =>
  rateLimit({
    windowMs: int(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    limit: int(process.env.RATE_LIMIT_MAX, 200),
    standardHeaders: 'draft-6', // RateLimit-Limit / -Remaining / -Reset (+ Retry-After on 429)
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP. Please try again later.',
        retryAfterSeconds: Math.max(Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000), 1),
      });
    },
  });

// Stricter limiter for credential endpoints (brute-force protection).
const makeAuthLimiter = () =>
  rateLimit({
    windowMs: int(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    limit: int(process.env.AUTH_RATE_LIMIT_MAX, 30),
    standardHeaders: 'draft-6',
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts. Please try again later.',
        retryAfterSeconds: Math.max(Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000), 1),
      });
    },
  });

module.exports = { makeApiLimiter, makeAuthLimiter };

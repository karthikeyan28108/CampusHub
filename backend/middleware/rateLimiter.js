import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for POST /api/auth/login
 * Max 10 attempts per IP every 15 minutes.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 1000, // Limit in production, generous in dev/test
  handler: (req, res) => {
    res.status(429).json({
      status: 'error',
      message: 'Too many login attempts. Please try again in 15 minutes.'
    });
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * IP-based Rate limiter for POST /api/auth/forgot-password
 * Max 3 requests per IP every 15 minutes.
 * Note: Email-based rate limiting is handled programmatically inside the route.
 */
export const forgotPasswordIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 3 : 1000,
  handler: (req, res) => {
    res.status(429).json({
      status: 'error',
      message: 'Too many requests. Please try again in 15 minutes.'
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

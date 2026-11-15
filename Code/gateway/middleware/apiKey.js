const crypto = require('crypto');

// Constant-time comparison; hashing first equalises lengths.
const safeEqual = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

/**
 * Gateway API key middleware. Protected requests must carry
 *   x-api-key: <GATEWAY_API_KEY>
 * The key itself is never logged or echoed back.
 */
const verifyApiKey = (req, res, next) => {
  const expected = process.env.GATEWAY_API_KEY;
  if (!expected) {
    return res.status(500).json({
      success: false,
      error: 'GATEWAY_MISCONFIGURED',
      message: 'Gateway API key is not configured on the server.',
    });
  }

  const key = req.get('x-api-key');
  if (!key) {
    return res.status(401).json({
      success: false,
      error: 'MISSING_API_KEY',
      message: 'API key is required. Include the x-api-key header.',
    });
  }
  if (!safeEqual(key, expected)) {
    return res.status(401).json({
      success: false,
      error: 'INVALID_API_KEY',
      message: 'The provided API key is invalid.',
    });
  }
  next();
};

module.exports = verifyApiKey;

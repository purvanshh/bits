/**
 * Central gateway error handler: malformed JSON, oversized bodies and
 * unexpected failures. Errors from backends (401 JWT, 403 role, 400, 404 …)
 * are proxied through untouched and never reach this handler.
 */
// eslint-disable-next-line no-unused-vars
const gatewayErrorHandler = (err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'MALFORMED_JSON',
      message: 'Request body contains invalid JSON.',
    });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'PAYLOAD_TOO_LARGE',
      message: 'Request body is too large.',
    });
  }

  console.error('Gateway error:', err.message);
  res.status(500).json({
    success: false,
    error: 'INTERNAL_GATEWAY_ERROR',
    message: 'An unexpected gateway error occurred.',
    ...(process.env.NODE_ENV === 'development' && { detail: err.message }),
  });
};

module.exports = gatewayErrorHandler;

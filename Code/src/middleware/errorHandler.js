const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    message = `A record with that ${field} already exists`;
    statusCode = 409;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    message = Object.values(err.errors).map((e) => e.message).join(', ');
    statusCode = 400;
  }

  // Mongoose cast error
  if (err.name === 'CastError') {
    message = `Invalid value for field: ${err.path}`;
    statusCode = 400;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    message = 'Invalid token';
    statusCode = 401;
  }
  if (err.name === 'TokenExpiredError') {
    message = 'Token expired';
    statusCode = 401;
  }

  if (err.retryAfter) res.set('Retry-After', String(err.retryAfter));

  res.status(statusCode).json({
    success: false,
    message,
    ...(err.code && typeof err.code === 'string' && { error: err.code }),
    ...(err.retryAfter && { retryAfter: err.retryAfter }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;

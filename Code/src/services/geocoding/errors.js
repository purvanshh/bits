const geocodingError = (statusCode, code, message, extra = {}) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  Object.assign(err, extra);
  return err;
};

module.exports = { geocodingError };

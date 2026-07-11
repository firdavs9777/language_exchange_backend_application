class ErrorResponse extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    if (code) this.errorCode = code; // 'code' collides with Node err.code (Mongo uses 11000)
  }
}
module.exports = ErrorResponse;

class FlameError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'FlameError';
    this.code = code;
    this.status = status;
  }
}

class AuthError extends FlameError {
  constructor(code, message) { super(code, message, 401); this.name = 'AuthError'; }
}

class NotFoundError extends FlameError {
  constructor(message = 'Not found') { super('NOT_FOUND', message, 404); this.name = 'NotFoundError'; }
}

class ValidationError extends FlameError {
  constructor(message) { super('VALIDATION', message, 422); this.name = 'ValidationError'; }
}

class ConflictError extends FlameError {
  constructor(code, message) { super(code, message, 409); this.name = 'ConflictError'; }
}

module.exports = { FlameError, AuthError, NotFoundError, ValidationError, ConflictError };

/**
 * Standardized API error class.
 * All errors thrown from services/controllers should use this.
 */
class AppError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Format a consistent error response body.
 */
const errorResponse = (res, status, code, message, details = null) => {
  const body = { status, code, message };
  if (details) body.details = details;
  return res.status(status).json(body);
};

/**
 * Format a consistent success response body.
 */
const successResponse = (res, data, status = 200, meta = null) => {
  const body = { status, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
};

// Predefined common errors
const Errors = {
  notFound: (resource = 'Resource') =>
    new AppError(404, 'NOT_FOUND', `${resource} not found`),
  unauthorized: (msg = 'Authentication required') =>
    new AppError(401, 'UNAUTHORIZED', msg),
  forbidden: (msg = 'You do not have permission to perform this action') =>
    new AppError(403, 'FORBIDDEN', msg),
  validation: (msg, details = null) =>
    new AppError(400, 'VALIDATION_ERROR', msg, details),
  conflict: (msg) =>
    new AppError(409, 'CONFLICT', msg),
  internal: (msg = 'An unexpected error occurred') =>
    new AppError(500, 'INTERNAL_ERROR', msg),
  invalidTransition: (from, to) =>
    new AppError(
      400,
      'INVALID_TRANSITION',
      `Cannot transition task from ${from} to ${to}`
    ),
};

module.exports = { AppError, errorResponse, successResponse, Errors };

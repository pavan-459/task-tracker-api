const { AppError } = require('../utils/response');

/**
 * Global error handler — must be registered last in Express middleware chain.
 * Catches all errors thrown or passed via next(err).
 */
const errorHandler = (err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${err.stack || err.message}`);

  if (err instanceof AppError) {
    const body = {
      status: err.status,
      code: err.code,
      message: err.message,
    };
    if (err.details) body.details = err.details;
    return res.status(err.status).json(body);
  }

  // Postgres unique violation
  if (err.code === '23505') {
    return res.status(409).json({
      status: 409,
      code: 'CONFLICT',
      message: 'A record with this value already exists',
    });
  }

  // Postgres foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({
      status: 400,
      code: 'INVALID_REFERENCE',
      message: 'Referenced resource does not exist',
    });
  }

  // Default 500
  return res.status(500).json({
    status: 500,
    code: 'INTERNAL_ERROR',
    message:
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : err.message,
  });
};

module.exports = { errorHandler };

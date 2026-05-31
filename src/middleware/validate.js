const { errorResponse } = require('../utils/response');

/**
 * Middleware factory that validates request body against a Joi schema.
 * Returns 400 with field-level error details on failure.
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message.replace(/['"]/g, ''),
      }));

      return errorResponse(
        res,
        400,
        'VALIDATION_ERROR',
        details[0].message,
        details
      );
    }

    req[source] = value; // replace with sanitized value
    next();
  };
};

module.exports = { validate };

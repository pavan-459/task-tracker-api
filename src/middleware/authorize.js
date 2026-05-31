const { ROLES } = require('../config/constants');
const { errorResponse } = require('../utils/response');

/**
 * RBAC middleware factory.
 * Usage: authorize(ROLES.ADMIN, ROLES.MANAGER)
 *
 * Enforced at the middleware layer — controllers never check roles directly.
 * This ensures a single source of truth for permission logic and makes
 * security audits straightforward.
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 401, 'UNAUTHORIZED', 'Authentication required');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return errorResponse(
        res,
        403,
        'FORBIDDEN',
        'You do not have permission to perform this action'
      );
    }

    next();
  };
};

// Convenience shorthands for common permission levels
const adminOnly = authorize(ROLES.ADMIN);
const managerAndAbove = authorize(ROLES.ADMIN, ROLES.MANAGER);
const anyRole = authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.MEMBER);

module.exports = { authorize, adminOnly, managerAndAbove, anyRole };

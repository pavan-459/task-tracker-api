const { verifyAccessToken } = require('../utils/jwt');
const { Errors, errorResponse } = require('../utils/response');

/**
 * Verifies the JWT access token from Authorization header.
 * Attaches decoded user info to req.user.
 */
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 401, 'UNAUTHORIZED', 'Authentication required');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      orgId: decoded.orgId,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return errorResponse(res, 401, 'TOKEN_EXPIRED', 'Access token has expired');
    }
    return errorResponse(res, 401, 'INVALID_TOKEN', 'Invalid access token');
  }
};

module.exports = { authenticate };

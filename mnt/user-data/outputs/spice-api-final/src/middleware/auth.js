const jwt = require('jsonwebtoken');

/**
 * Express middleware that validates the JWT sent in cookies or Authorization header.
 *
 * Usage:
 *   router.get('/protected', requireAuth, (req, res) => {
 *     res.json({ user: req.user });
 *   });
 *
 * The token payload is attached to req.user after successful verification.
 */
function requireAuth(req, res, next) {
  let token = req.cookies.token; // Check cookie first

  if (!token) {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization missing or malformed' });
    }
    token = header.split(' ')[1];
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Middleware factory that restricts access to specific roles.
 * Must be used AFTER requireAuth.
 *
 * Usage:
 *   router.delete('/users/:id', requireAuth, requireRole('administrador'), handler);
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({ error: `Access denied. Required role: ${roles.join(' or ')}` });
    }

    const userRoles = Array.isArray(req.user.roles)
      ? req.user.roles
      : Array.isArray(req.user.role)
        ? req.user.role
        : req.user.role
          ? [req.user.role]
          : [];

    const hasRole = roles.some(role => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({ error: `Access denied. Required role: ${roles.join(' or ')}` });
    }

    next();
  };
}

module.exports = { requireAuth, requireRole };

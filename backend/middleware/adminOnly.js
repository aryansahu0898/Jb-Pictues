/**
 * Admin role guard.
 */

// Section: Middleware
/**
 * Ensures the authenticated user has the admin role.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ message: 'Admin access is required.' });
    return;
  }

  next();
}

module.exports = adminOnly;

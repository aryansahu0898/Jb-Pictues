/**
 * Authentication middleware.
 */

const jwt = require('jsonwebtoken');

const User = require('../models/User');

// Section: Middleware
/**
 * Verifies a bearer access token and attaches the current user to the request.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
async function verifyToken(req, res, next) {
  const authorization = req.headers.authorization || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ message: 'Authorization token is required.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(decoded.id).select('-password').lean();

    if (!user) {
      res.status(401).json({ message: 'User not found.' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired access token.' });
  }
}

module.exports = {
  verifyToken
};

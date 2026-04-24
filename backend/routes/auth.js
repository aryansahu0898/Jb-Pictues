/**
 * Authentication routes.
 */

const bcrypt = require('bcryptjs');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');

const User = require('../models/User');

// Section: Router
const router = express.Router();

const RefreshToken = mongoose.models.RefreshToken || mongoose.model('RefreshToken', new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '7d'
  }
}, {
  versionKey: false
}));

/**
 * Returns formatted validation errors when a request is invalid.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {boolean}
 */
function sendValidationErrors(req, res) {
  const errors = validationResult(req);

  if (errors.isEmpty()) {
    return false;
  }

  res.status(400).json({
    message: 'Validation failed.',
    errors: errors.array()
  });
  return true;
}

/**
 * Builds a signed access token for API requests.
 * @param {string} userId
 * @param {string} role
 * @returns {string}
 */
function createAccessToken(userId, role) {
  return jwt.sign({ id: userId, role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: '15m'
  });
}

/**
 * Builds a refresh token for session renewal.
 * @param {string} userId
 * @returns {string}
 */
function createRefreshToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '7d'
  });
}

/**
 * Registers a new user account.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function registerUser(req, res) {
  if (sendValidationErrors(req, res)) {
    return;
  }

  const { name, email, mobile, password } = req.body;
  const existingUser = await User.findOne({ email }).lean();

  if (existingUser) {
    res.status(409).json({ message: 'An account already exists with this email address.' });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await User.create({
    name,
    email,
    mobile,
    password: hashedPassword,
    isVerified: true
  });

  res.status(201).json({
    message: 'Registration successful.',
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role
    }
  });
}

/**
 * Logs a user in and stores a refresh token in MongoDB.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function loginUser(req, res) {
  if (sendValidationErrors(req, res)) {
    return;
  }

  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    res.status(401).json({ message: 'Invalid email or password.' });
    return;
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    res.status(401).json({ message: 'Invalid email or password.' });
    return;
  }

  const accessToken = createAccessToken(String(user._id), user.role);
  const refreshToken = createRefreshToken(String(user._id));

  await RefreshToken.create({
    userId: user._id,
    token: refreshToken
  });

  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role
    }
  });
}

/**
 * Exchanges a refresh token for a new access token.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function refreshSession(req, res) {
  if (sendValidationErrors(req, res)) {
    return;
  }

  const { refreshToken } = req.body;
  const storedToken = await RefreshToken.findOne({ token: refreshToken }).lean();

  if (!storedToken) {
    res.status(403).json({ message: 'Refresh token is not valid.' });
    return;
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id).lean();

    if (!user) {
      await RefreshToken.deleteOne({ token: refreshToken });
      res.status(403).json({ message: 'Refresh token user no longer exists.' });
      return;
    }

    res.json({
      accessToken: createAccessToken(String(user._id), user.role)
    });
  } catch (error) {
    await RefreshToken.deleteOne({ token: refreshToken });
    res.status(401).json({ message: 'Refresh token has expired or is invalid.' });
  }
}

/**
 * Logs the user out by deleting the refresh token document.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function logoutUser(req, res) {
  if (sendValidationErrors(req, res)) {
    return;
  }

  await RefreshToken.deleteOne({ token: req.body.refreshToken });
  res.json({ message: 'Logout successful.' });
}

router.post('/register', [
  body('name').trim().notEmpty().withMessage('Full name is required.').escape(),
  body('email').trim().isEmail().withMessage('A valid email is required.').normalizeEmail(),
  body('mobile').trim().matches(/^\d{10}$/).withMessage('Mobile number must contain 10 digits.'),
  body('password').trim().isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.')
], function registerHandler(req, res, next) {
  registerUser(req, res).catch(next);
});

router.post('/login', [
  body('email').trim().isEmail().withMessage('A valid email is required.').normalizeEmail(),
  body('password').trim().notEmpty().withMessage('Password is required.')
], function loginHandler(req, res, next) {
  loginUser(req, res).catch(next);
});

router.post('/refresh', [
  body('refreshToken').trim().notEmpty().withMessage('Refresh token is required.')
], function refreshHandler(req, res, next) {
  refreshSession(req, res).catch(next);
});

router.post('/logout', [
  body('refreshToken').trim().notEmpty().withMessage('Refresh token is required.')
], function logoutHandler(req, res, next) {
  logoutUser(req, res).catch(next);
});

module.exports = router;

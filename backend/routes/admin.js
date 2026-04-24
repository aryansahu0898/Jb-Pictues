/**
 * Admin routes.
 */

const express = require('express');
const mongoose = require('mongoose');
const { param, query, validationResult } = require('express-validator');

const adminOnly = require('../middleware/adminOnly');
const { verifyToken } = require('../middleware/auth');
const Event = require('../models/Event');
const FaceData = require('../models/FaceData');
const Image = require('../models/Image');
const User = require('../models/User');

// Section: Router
const router = express.Router();

const RefreshToken = mongoose.models.RefreshToken || mongoose.model('RefreshToken', new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: '7d' }
}, {
  versionKey: false
}));

router.use(verifyToken, adminOnly);

/**
 * Sends validation errors when the request is invalid.
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
 * Parses pagination parameters from a request.
 * @param {import('express').Request} req
 * @returns {{ page: number, limit: number, skip: number }}
 */
function getPagination(req) {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

  return {
    page,
    limit,
    skip: (page - 1) * limit
  };
}

/**
 * Returns dashboard aggregates for the admin UI.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function getDashboard(req, res) {
  const [totalUsers, totalEvents, totalImages, totalFaces] = await Promise.all([
    User.countDocuments(),
    Event.countDocuments(),
    Image.countDocuments(),
    FaceData.countDocuments()
  ]);

  res.json({
    totalUsers,
    totalEvents,
    totalImages,
    totalFaces
  });
}

/**
 * Returns a paginated list of users for the admin interface.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function getUsers(req, res) {
  if (sendValidationErrors(req, res)) {
    return;
  }

  const { page, limit, skip } = getPagination(req);
  const [users, total] = await Promise.all([
    User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments()
  ]);

  res.json({
    users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  });
}

/**
 * Deletes a user and any refresh tokens tied to that user.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function deleteUser(req, res) {
  if (sendValidationErrors(req, res)) {
    return;
  }

  if (String(req.user._id) === req.params.id) {
    res.status(400).json({ message: 'You cannot delete your own admin account.' });
    return;
  }

  const deletedUser = await User.findByIdAndDelete(req.params.id);

  if (!deletedUser) {
    res.status(404).json({ message: 'User not found.' });
    return;
  }

  await RefreshToken.deleteMany({ userId: deletedUser._id });

  res.json({
    message: 'User deleted successfully.'
  });
}

router.get('/dashboard', function dashboardHandler(req, res, next) {
  getDashboard(req, res).catch(next);
});

router.get('/users', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.')
], function usersHandler(req, res, next) {
  getUsers(req, res).catch(next);
});

router.delete('/users/:id', [
  param('id').custom(function validateId(value) {
    return mongoose.Types.ObjectId.isValid(value);
  }).withMessage('A valid user id is required.')
], function deleteUserHandler(req, res, next) {
  deleteUser(req, res).catch(next);
});

module.exports = router;

/**
 * Event routes.
 */

const express = require('express');
const mongoose = require('mongoose');
const { body, param, query, validationResult } = require('express-validator');

const adminOnly = require('../middleware/adminOnly');
const { verifyToken } = require('../middleware/auth');
const { uploadBuffer, buildOptimizedImageUrl, deleteAsset, extractPublicId } = require('../config/cloudinary');
const Event = require('../models/Event');
const FaceData = require('../models/FaceData');
const Image = require('../models/Image');

// Section: Router
const router = express.Router();

/**
 * Sends express-validator errors to the client.
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
 * Parses a base64 data URI into an image buffer.
 * @param {string} dataUri
 * @returns {{ buffer: Buffer, extension: string }}
 */
function parseDataUriImage(dataUri) {
  const match = dataUri.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/i);

  if (!match) {
    throw new Error('Cover image must be a valid image file or data URI.');
  }

  return {
    extension: match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase(),
    buffer: Buffer.from(match[2], 'base64')
  };
}

/**
 * Creates a Cloudinary cover image when a base64 payload is provided.
 * @param {string} coverImage
 * @param {string} eventName
 * @returns {Promise<string>}
 */
async function resolveCoverImage(coverImage, eventName) {
  if (!coverImage) {
    return '';
  }

  if (!coverImage.startsWith('data:image/')) {
    return coverImage;
  }

  const { buffer, extension } = parseDataUriImage(coverImage);
  const uploadResult = await uploadBuffer(buffer, {
    folder: 'jb-function-capture/event-covers',
    public_id: `${eventName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
    format: extension
  });

  return buildOptimizedImageUrl(uploadResult.public_id, 1200);
}

/**
 * Parses pagination values from a request.
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
 * Returns public event listings.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function listEvents(req, res) {
  if (sendValidationErrors(req, res)) {
    return;
  }

  const { page, limit, skip } = getPagination(req);
  const [events, total] = await Promise.all([
    Event.find()
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Event.countDocuments()
  ]);

  res.json({
    events,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  });
}

/**
 * Creates a new event.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function createEvent(req, res) {
  if (sendValidationErrors(req, res)) {
    return;
  }

  const coverImage = await resolveCoverImage(req.body.coverImage, req.body.name);

  const event = await Event.create({
    name: req.body.name,
    description: req.body.description || '',
    date: req.body.date,
    coverImage,
    createdBy: req.user._id
  });

  res.status(201).json(event);
}

/**
 * Updates an existing event.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function updateEvent(req, res) {
  if (sendValidationErrors(req, res)) {
    return;
  }

  const event = await Event.findById(req.params.id);

  if (!event) {
    res.status(404).json({ message: 'Event not found.' });
    return;
  }

  if (req.body.name) {
    event.name = req.body.name;
  }

  if (req.body.description !== undefined) {
    event.description = req.body.description;
  }

  if (req.body.date) {
    event.date = req.body.date;
  }

  if (req.body.coverImage) {
    const previousCoverPublicId = extractPublicId(event.coverImage);
    event.coverImage = await resolveCoverImage(req.body.coverImage, event.name);

    if (req.body.coverImage.startsWith('data:image/') && previousCoverPublicId) {
      await deleteAsset(previousCoverPublicId);
    }
  }

  await event.save();
  res.json(event);
}

/**
 * Deletes an event and all related Cloudinary media.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function deleteEvent(req, res) {
  if (sendValidationErrors(req, res)) {
    return;
  }

  const event = await Event.findById(req.params.id);

  if (!event) {
    res.status(404).json({ message: 'Event not found.' });
    return;
  }

  const images = await Image.find({ eventId: event._id }).lean();

  await Promise.all(images.map(function removeCloudinaryImage(image) {
    return deleteAsset(image.publicId);
  }));

  const coverPublicId = extractPublicId(event.coverImage);
  if (coverPublicId) {
    await deleteAsset(coverPublicId);
  }

  await Promise.all([
    FaceData.deleteMany({ eventId: event._id }),
    Image.deleteMany({ eventId: event._id }),
    Event.findByIdAndDelete(event._id)
  ]);

  res.json({ message: 'Event and related images deleted successfully.' });
}

router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.')
], function listEventsHandler(req, res, next) {
  listEvents(req, res).catch(next);
});

router.post('/', verifyToken, adminOnly, [
  body('name').trim().notEmpty().withMessage('Event name is required.').escape(),
  body('description').optional({ values: 'falsy' }).trim().escape(),
  body('date').isISO8601().withMessage('Event date must be valid.').toDate(),
  body('coverImage').notEmpty().withMessage('A cover image is required.')
], function createEventHandler(req, res, next) {
  createEvent(req, res).catch(next);
});

router.put('/:id', verifyToken, adminOnly, [
  param('id').custom(function validateId(value) {
    return mongoose.Types.ObjectId.isValid(value);
  }).withMessage('A valid event id is required.'),
  body('name').optional().trim().notEmpty().withMessage('Event name cannot be empty.').escape(),
  body('description').optional().trim().escape(),
  body('date').optional().isISO8601().withMessage('Event date must be valid.').toDate(),
  body('coverImage').optional().notEmpty().withMessage('Cover image cannot be empty.')
], function updateEventHandler(req, res, next) {
  updateEvent(req, res).catch(next);
});

router.delete('/:id', verifyToken, adminOnly, [
  param('id').custom(function validateId(value) {
    return mongoose.Types.ObjectId.isValid(value);
  }).withMessage('A valid event id is required.')
], function deleteEventHandler(req, res, next) {
  deleteEvent(req, res).catch(next);
});

module.exports = router;

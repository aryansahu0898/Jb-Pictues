/**
 * Face matching routes.
 */

const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');

const FaceData = require('../models/FaceData');
const Image = require('../models/Image');
const { euclideanDistance, FACE_MATCH_THRESHOLD } = require('../utils/euclidean');

// Section: Router
const router = express.Router();

/**
 * Sends validation errors to the client.
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
 * Matches a single face descriptor against every face in an event.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
async function matchFace(req, res) {
  if (sendValidationErrors(req, res)) {
    return;
  }

  const descriptor = req.body.descriptor.map(Number);
  const faceRecords = await FaceData.find({ eventId: req.body.eventId })
    .select('imageId descriptor')
    .lean();

  const matchingImageIds = new Set();

  faceRecords.forEach(function compareFace(faceRecord) {
    if (euclideanDistance(faceRecord.descriptor, descriptor) <= FACE_MATCH_THRESHOLD) {
      matchingImageIds.add(String(faceRecord.imageId));
    }
  });

  if (matchingImageIds.size === 0) {
    res.json({ matches: [] });
    return;
  }

  const matches = await Image.find({
    _id: { $in: Array.from(matchingImageIds) }
  }).sort({ uploadedAt: -1 }).lean();

  res.json({ matches });
}

router.post('/match', [
  body('eventId').custom(function validateEventId(value) {
    return mongoose.Types.ObjectId.isValid(value);
  }).withMessage('A valid event id is required.'),
  body('descriptor')
    .isArray({ min: 128, max: 128 })
    .withMessage('Descriptor must contain 128 numeric values.'),
  body('descriptor.*').isFloat().withMessage('Descriptor values must be numeric.')
], function matchFaceHandler(req, res, next) {
  matchFace(req, res).catch(next);
});

module.exports = router;

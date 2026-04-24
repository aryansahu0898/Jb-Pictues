/**
 * Image model.
 */

const mongoose = require('mongoose');

// Section: Subdocuments
const faceEmbeddingSchema = new mongoose.Schema({
  descriptor: {
    type: [Number],
    required: true,
    validate: {
      validator: function validateDescriptor(value) {
        return Array.isArray(value) && value.length === 128;
      },
      message: 'Face descriptors must contain 128 values.'
    }
  },
  boundingBox: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true }
  }
}, {
  _id: false
});

// Section: Schema
const imageSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  url: {
    type: String,
    required: true
  },
  publicId: {
    type: String,
    required: true
  },
  thumbnailUrl: {
    type: String,
    default: ''
  },
  faceCount: {
    type: Number,
    default: 0
  },
  faceEmbeddings: {
    type: [faceEmbeddingSchema],
    default: []
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
}, {
  versionKey: false
});

imageSchema.index({ eventId: 1, uploadedAt: -1 });

module.exports = mongoose.model('Image', imageSchema);

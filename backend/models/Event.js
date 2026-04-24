/**
 * Event model.
 */

const mongoose = require('mongoose');

// Section: Schema
const eventSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  coverImage: {
    type: String,
    default: ''
  },
  imageCount: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  versionKey: false
});

eventSchema.index({ date: -1 });

module.exports = mongoose.model('Event', eventSchema);

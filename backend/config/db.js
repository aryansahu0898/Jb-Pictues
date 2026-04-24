/**
 * MongoDB configuration.
 */

const mongoose = require('mongoose');

// Section: Connection
mongoose.set('strictQuery', true);

/**
 * Connects the API to MongoDB.
 * @returns {Promise<typeof mongoose>}
 */
async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured.');
  }

  const connection = await mongoose.connect(process.env.MONGODB_URI, {
    autoIndex: true
  });

  console.log(`MongoDB connected: ${connection.connection.host}`);
  return connection;
}

module.exports = connectDB;

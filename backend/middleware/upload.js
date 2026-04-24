/**
 * Upload middleware.
 */

const multer = require('multer');

// Section: Configuration
const storage = multer.memoryStorage();

/**
 * Validates that uploaded files are supported images.
 * @param {import('express').Request} req
 * @param {Express.Multer.File} file
 * @param {(error: Error | null, acceptFile?: boolean) => void} callback
 * @returns {void}
 */
function imageFileFilter(req, file, callback) {
  const isImage = /^image\/(jpeg|jpg|png|webp)$/i.test(file.mimetype);

  if (!isImage) {
    callback(new Error('Only JPEG, PNG, and WEBP image files are supported.'));
    return;
  }

  callback(null, true);
}

/**
 * Multer instance for bulk image uploads.
 */
const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 20
  }
});

module.exports = upload;

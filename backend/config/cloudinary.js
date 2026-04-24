/**
 * Cloudinary configuration and helpers.
 */

const path = require('path');
const cloudinary = require('cloudinary').v2;

// Section: Base Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * Uploads an image buffer to Cloudinary.
 * @param {Buffer} buffer
 * @param {import('cloudinary').UploadApiOptions} [options]
 * @returns {Promise<import('cloudinary').UploadApiResponse>}
 */
function uploadBuffer(buffer, options = {}) {
  return new Promise(function resolveUpload(resolve, reject) {
    const uploadStream = cloudinary.uploader.upload_stream({
      folder: 'jb-function-capture',
      resource_type: 'image',
      type: 'authenticated',
      access_mode: 'authenticated',
      ...options
    }, function onUploadComplete(error, result) {
      if (error) {
        reject(error);
        return;
      }

      resolve(result);
    });

    uploadStream.end(buffer);
  });
}

/**
 * Creates a signed Cloudinary delivery URL.
 * @param {string} publicId
 * @param {number} width
 * @returns {string}
 */
function buildOptimizedImageUrl(publicId, width) {
  return cloudinary.url(publicId, {
    secure: true,
    sign_url: true,
    type: 'authenticated',
    fetch_format: 'auto',
    quality: 'auto',
    width,
    crop: 'limit'
  });
}

/**
 * Tries to derive a Cloudinary public id from a delivery URL.
 * @param {string} url
 * @returns {string | null}
 */
function extractPublicId(url) {
  if (!url) {
    return null;
  }

  const parsed = url.match(/\/image\/(?:upload|authenticated|private)\/(.+)/);

  if (!parsed) {
    return null;
  }

  let publicPath = parsed[1].split('?')[0];
  publicPath = publicPath.replace(/^s--[^/]+--\//, '');
  publicPath = publicPath.replace(/^v\d+\//, '');

  const extension = path.extname(publicPath);
  return extension ? publicPath.slice(0, -extension.length) : publicPath;
}

/**
 * Deletes a Cloudinary asset when a public id is available.
 * @param {string | null | undefined} publicId
 * @returns {Promise<void>}
 */
async function deleteAsset(publicId) {
  if (!publicId) {
    return;
  }

  await cloudinary.uploader.destroy(publicId, {
    resource_type: 'image',
    type: 'authenticated',
    invalidate: true
  });
}

module.exports = {
  cloudinary,
  uploadBuffer,
  buildOptimizedImageUrl,
  extractPublicId,
  deleteAsset
};

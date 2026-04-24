/**
 * Euclidean distance helpers.
 */

// Section: Constants
const FACE_MATCH_THRESHOLD = 0.5;

/**
 * Calculates Euclidean distance between two equal-length numeric arrays.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function euclideanDistance(a, b) {
  return Math.sqrt(a.reduce(function addDistance(sum, value, index) {
    return sum + Math.pow(value - b[index], 2);
  }, 0));
}

module.exports = {
  euclideanDistance,
  FACE_MATCH_THRESHOLD
};

const crypto = require("crypto");

/**
 * Computes the SHA-256 hash of text content (used for prompts/articles).
 * @param {string} text
 * @returns {string} hex-encoded hash, 0x-prefixed to match on-chain bytes32 format
 */
function sha256Text(text) {
  const hash = crypto.createHash("sha256").update(text, "utf8").digest("hex");
  return `0x${hash}`;
}

/**
 * Computes the SHA-256 hash of a binary buffer (used for image/music/video files in later phases).
 * @param {Buffer} buffer
 * @returns {string} hex-encoded hash, 0x-prefixed
 */
function sha256Buffer(buffer) {
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  return `0x${hash}`;
}

module.exports = { sha256Text, sha256Buffer };

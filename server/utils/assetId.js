const { ethers } = require("ethers");
const crypto = require("crypto");

/**
 * Derives a unique bytes32 assetId from a content hash + a random salt.
 * The salt guarantees uniqueness even if two different owners register
 * byte-identical content (rare, but SHA-256 collisions of content are
 * intentionally NOT what makes an assetId unique — ownership + hash + salt is).
 * @param {string} contentHash 0x-prefixed SHA-256 hash
 * @returns {string} 0x-prefixed bytes32 assetId
 */
function deriveAssetId(contentHash) {
  const salt = crypto.randomBytes(16).toString("hex");
  return ethers.keccak256(
    ethers.solidityPacked(["bytes32", "string"], [contentHash, salt])
  );
}

module.exports = { deriveAssetId };

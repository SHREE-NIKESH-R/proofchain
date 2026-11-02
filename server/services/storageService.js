/**
 * StorageService interface (spec Section 12).
 *
 * Local-disk implementation for now — genuinely free, no account/credit-card needed,
 * matches the roadmap's "don't let hosting restrictions complicate development now"
 * decision. Swapping in Cloudinary/S3/etc. later means implementing this same interface
 * and changing one require() in the controller — nothing else in the app should need to
 * know which provider is behind it.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

/**
 * Saves a buffer to local disk under a collision-resistant filename and returns
 * a URL path the client can fetch it from (served via express.static, see app.js).
 */
async function upload(buffer, originalFilename, contentType) {
  ensureUploadDir();
  const ext = path.extname(originalFilename) || "";
  const safeName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
  const filePath = path.join(UPLOAD_DIR, safeName);

  await fs.promises.writeFile(filePath, buffer);

  return {
    url: `/uploads/${safeName}`,
    storedName: safeName,
    contentType,
    sizeBytes: buffer.length,
  };
}

function getUrl(storedName) {
  return `/uploads/${storedName}`;
}

async function remove(storedName) {
  const filePath = path.join(UPLOAD_DIR, storedName);
  await fs.promises.unlink(filePath).catch(() => {}); // no-op if already gone
}

function validate(file, { maxBytes, allowedMimeTypes }) {
  if (file.size > maxBytes) {
    return {
      valid: false,
      reason: `File exceeds the maximum allowed size of ${Math.round(maxBytes / 1024 / 1024)}MB`,
    };
  }
  if (allowedMimeTypes && !allowedMimeTypes.includes(file.mimetype)) {
    return { valid: false, reason: `Unsupported file type: ${file.mimetype}` };
  }
  return { valid: true };
}

module.exports = { upload, getUrl, remove, validate, UPLOAD_DIR };

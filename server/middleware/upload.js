const multer = require("multer");

// In-memory storage: files are held as a Buffer just long enough to hash, run through
// the originality engine, and hand to storageService.upload(). Keeps this middleware
// storage-provider-agnostic — it never writes to disk itself.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024 }, // hard ceiling; per-type limits enforced in the controller
});

const LIMITS = {
  image: { maxBytes: 8 * 1024 * 1024, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] },
  music: { maxBytes: 20 * 1024 * 1024, allowedMimeTypes: ["audio/mpeg", "audio/wav", "audio/mp3", "audio/x-wav"] },
  video: { maxBytes: 60 * 1024 * 1024, allowedMimeTypes: ["video/mp4", "video/webm", "video/quicktime"] },
};

module.exports = { upload, LIMITS };

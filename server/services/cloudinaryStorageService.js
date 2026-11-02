const crypto = require("crypto");
const path = require("path");
const { v2: cloudinary } = require("cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

function assertConfigured() {
  const missing = [
    ["CLOUDINARY_CLOUD_NAME", process.env.CLOUDINARY_CLOUD_NAME],
    ["CLOUDINARY_API_KEY", process.env.CLOUDINARY_API_KEY],
    ["CLOUDINARY_API_SECRET", process.env.CLOUDINARY_API_SECRET],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Cloudinary storage is missing: ${missing.join(", ")}`);
  }
}

function encodeStoredName(resourceType, publicId) {
  return Buffer.from(JSON.stringify({ resourceType, publicId })).toString(
    "base64url",
  );
}

function decodeStoredName(storedName) {
  return JSON.parse(Buffer.from(storedName, "base64url").toString("utf8"));
}

function uploadBuffer(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );
    stream.end(buffer);
  });
}

async function upload(buffer, originalFilename, contentType) {
  assertConfigured();
  const result = await uploadBuffer(buffer, {
    folder: "proofchain/assets",
    public_id: `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${path.extname(originalFilename)}`,
    resource_type: "auto",
    use_filename: false,
    overwrite: false,
  });

  return {
    url: result.secure_url,
    storedName: encodeStoredName(result.resource_type, result.public_id),
    contentType,
    sizeBytes: result.bytes || buffer.length,
  };
}

function getUrl(storedName) {
  const { resourceType, publicId } = decodeStoredName(storedName);
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    secure: true,
  });
}

async function remove(storedName) {
  assertConfigured();
  const { resourceType, publicId } = decodeStoredName(storedName);
  await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    invalidate: true,
  });
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

module.exports = { upload, getUrl, remove, validate };

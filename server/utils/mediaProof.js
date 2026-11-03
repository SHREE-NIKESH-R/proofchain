const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const NodeID3 = require("node-id3");

const PROOF_PREFIX = "PROOFCHAIN:";
const AUDIO_TYPES = new Set(["audio/mpeg", "audio/mp3"]);

function getExifToolPath() {
  if (process.platform === "win32") {
    return require("exiftool-vendored.exe");
  }
  return require("exiftool-vendored.pl");
}

function runExifTool(args) {
  return new Promise((resolve, reject) => {
    execFile(
      getExifToolPath(),
      args,
      { windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          error.status = error.code === 1 ? 422 : 500;
          if (error.status === 422) {
            error.message = "The image metadata could not be read or written";
          }
          reject(error);
          return;
        }
        resolve(stdout);
      },
    );
  });
}

function validateTransactionHash(txHash) {
  if (typeof txHash !== "string" || !/^0x[a-fA-F0-9]{64}$/.test(txHash.trim())) {
    const error = new Error("txHash must be a 32-byte hexadecimal transaction hash");
    error.status = 400;
    throw error;
  }
  return txHash.trim();
}

function proofTag(txHash) {
  return `${PROOF_PREFIX}${validateTransactionHash(txHash)}`;
}

function validateMediaFile(file, contentType) {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
    const error = new Error("A media file is required");
    error.status = 400;
    throw error;
  }

  const name = path.basename(file.originalname || "").toLowerCase();
  const buffer = file.buffer;
  let valid = false;

  if (contentType === "image") {
    if (buffer.length > 8 * 1024 * 1024) {
      const error = new Error("Image must be 8 MB or smaller");
      error.status = 413;
      throw error;
    }

    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng =
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isWebp =
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP";

    valid =
      (file.mimetype === "image/jpeg" && name.endsWith(".jpg") && isJpeg) ||
      (file.mimetype === "image/jpeg" && name.endsWith(".jpeg") && isJpeg) ||
      (file.mimetype === "image/png" && name.endsWith(".png") && isPng) ||
      (file.mimetype === "image/webp" && name.endsWith(".webp") && isWebp);
  } else if (contentType === "music") {
    if (buffer.length > 20 * 1024 * 1024) {
      const error = new Error("Audio must be 20 MB or smaller");
      error.status = 413;
      throw error;
    }

    const hasId3Header =
      buffer.length >= 10 &&
      buffer.toString("ascii", 0, 3) === "ID3" &&
      buffer[3] >= 2 &&
      buffer[3] <= 4;
    const hasMpegFrameHeader =
      buffer.length >= 2 &&
      buffer[0] === 0xff &&
      (buffer[1] & 0xe0) === 0xe0;
    valid =
      AUDIO_TYPES.has(file.mimetype) &&
      name.endsWith(".mp3") &&
      (hasId3Header || hasMpegFrameHeader);
  } else {
    const error = new Error('contentType must be "image" or "music"');
    error.status = 400;
    throw error;
  }

  if (!valid) {
    const error = new Error(
      contentType === "music"
        ? "Choose a valid MP3 file"
        : "Choose a valid JPEG, PNG, or WebP image",
    );
    error.status = 415;
    throw error;
  }
}

async function withTemporaryMediaFile(file, callback) {
  const directory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "proofchain-media-proof-"),
  );
  const extension = path.extname(file.originalname || "").toLowerCase();
  const filePath = path.join(directory, `media${extension}`);

  try {
    await fs.promises.writeFile(filePath, file.buffer, { flag: "wx" });
    return await callback(filePath);
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
}

async function embedMediaProof(file, contentType, txHash) {
  validateMediaFile(file, contentType);
  const tag = proofTag(txHash);

  if (contentType === "music") {
    const output = NodeID3.update(
      { comment: { language: "eng", text: tag } },
      file.buffer,
    );
    if (output instanceof Error || !Buffer.isBuffer(output)) {
      throw output instanceof Error ? output : new Error("Could not write MP3 ID3 metadata");
    }
    return output;
  }

  return withTemporaryMediaFile(file, async (filePath) => {
    await runExifTool(["-overwrite_original", `-UserComment=${tag}`, filePath]);
    return fs.promises.readFile(filePath);
  });
}

async function extractMediaProof(file, contentType) {
  validateMediaFile(file, contentType);

  let value;
  if (contentType === "music") {
    const tags = NodeID3.read(file.buffer);
    value = tags?.comment?.text;
  } else {
    value = await withTemporaryMediaFile(file, async (filePath) => {
      const output = await runExifTool(["-s3", "-UserComment", filePath]);
      return output.trimEnd();
    });
  }

  if (typeof value !== "string" || !value.startsWith(PROOF_PREFIX)) {
    return null;
  }
  return value.slice(PROOF_PREFIX.length);
}

module.exports = {
  embedMediaProof,
  extractMediaProof,
  validateMediaFile,
  validateTransactionHash,
};

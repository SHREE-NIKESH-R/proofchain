const mongoose = require("mongoose");

const SUPPORTED_CONTENT_TYPES = ["prompt", "article", "image", "music", "video"];
const AI_MODELS = [
  "ChatGPT",
  "Claude",
  "Gemini",
  "Midjourney",
  "Flux",
  "Stable Diffusion",
  "Runway",
  "Other",
  "Human-created / Unknown",
];

const assetSchema = new mongoose.Schema(
  {
    // Matches the bytes32 assetId used on-chain (hex string, 0x-prefixed).
    assetId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    contentType: {
      type: String,
      enum: SUPPORTED_CONTENT_TYPES,
      required: true,
    },
    // For prompt/article, we store the raw text (small). For image/music/video (Phase 2+),
    // this becomes a URL from StorageService — never the raw binary in Mongo.
    textContent: { type: String, default: null },
    fileUrl: { type: String, default: null },

    // SHA-256 hash, matches the on-chain contentHash.
    contentHash: { type: String, required: true, index: true },

    ownerWallet: { type: String, required: true, lowercase: true },
    blockchainTxHash: { type: String, required: true },
    registeredAt: { type: Date, required: true },

    aiModel: { type: String, enum: AI_MODELS, default: "Human-created / Unknown" },
    version: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ["active", "transferred", "deactivated"],
      default: "active",
    },

    // Populated in later phases (2/3) — left null/empty for now, on purpose.
    originalityAnalysis: { type: mongoose.Schema.Types.Mixed, default: null },
    evidenceScore: { type: Number, default: null },
    // Last-computed breakdown, stored for listing/dashboard use. Asset Details always
    // recomputes a fresh one (see getAssetById) rather than trusting this snapshot alone.
    evidenceScoreBreakdown: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Asset", assetSchema);
module.exports.SUPPORTED_CONTENT_TYPES = SUPPORTED_CONTENT_TYPES;
module.exports.AI_MODELS = AI_MODELS;

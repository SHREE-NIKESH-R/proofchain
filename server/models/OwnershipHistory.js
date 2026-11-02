const mongoose = require("mongoose");

// This is a cache/mirror of on-chain OwnershipTransferred events, kept for fast
// reads (asset detail page, profile stats) without hitting the RPC node every time.
// The blockchain remains the source of truth — this collection is rebuildable
// from getOwnershipHistory() at any point.
const ownershipHistorySchema = new mongoose.Schema(
  {
    assetId: { type: String, required: true, index: true },
    fromWallet: { type: String, required: true, lowercase: true },
    toWallet: { type: String, required: true, lowercase: true },
    txHash: { type: String, required: true },
    timestamp: { type: Date, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("OwnershipHistory", ownershipHistorySchema);

const mongoose = require("mongoose");

/**
 * A creator's display name, associated with their wallet address.
 *
 * IMPORTANT: this is a platform-level label only. The blockchain record (ProofChain.sol)
 * has no concept of a display name — asset ownership on-chain is identified purely by
 * wallet address. This collection lets the UI show "Jane Doe (0x1234...)" instead of a
 * bare address, but the wallet address remains the actual, verifiable identity. Never
 * render a display name without the wallet address nearby, and never claim the name is
 * part of the on-chain proof.
 */
const profileSchema = new mongoose.Schema(
  {
    walletAddress: { type: String, required: true, unique: true, lowercase: true, index: true },
    displayName: { type: String, required: true, trim: true, maxlength: 60 },
    bio: { type: String, default: "", maxlength: 280 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Profile", profileSchema);

const mongoose = require("mongoose");

const disputeSchema = new mongoose.Schema(
  {
    assetId: { type: String, required: true, index: true },
    claimantWallet: { type: String, required: true, lowercase: true },
    reason: { type: String, required: true, trim: true },
    hashHistory: { type: String, default: "" },
    timestamp: { type: String, default: "" },
    evidenceFile: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Pending review", "Escrowed", "Resolved", "Rejected"],
      default: "Pending review",
    },
    adminNote: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Dispute", disputeSchema);

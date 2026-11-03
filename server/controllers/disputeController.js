const Dispute = require("../models/Dispute");

const DISPUTE_STATUSES = ["Pending review", "Escrowed", "Resolved", "Rejected"];

async function listDisputes(req, res, next) {
  try {
    const disputes = await Dispute.find().sort({ createdAt: -1 });
    res.json({ disputes });
  } catch (error) {
    next(error);
  }
}

async function listDisputesForAsset(req, res, next) {
  try {
    const { assetId } = req.params;
    const disputes = await Dispute.find({
      assetId: String(assetId).trim(),
    }).sort({ createdAt: -1 });
    res.json({ disputes });
  } catch (error) {
    next(error);
  }
}

async function createDispute(req, res, next) {
  try {
    const {
      assetId,
      claimantWallet,
      reason,
      hashHistory,
      timestamp,
      evidenceFile,
    } = req.body || {};

    if (!assetId || !String(assetId).trim()) {
      return res.status(400).json({ error: "assetId is required" });
    }
    if (!claimantWallet || !String(claimantWallet).trim()) {
      return res.status(400).json({ error: "claimantWallet is required" });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ error: "reason is required" });
    }

    const dispute = await Dispute.create({
      assetId: String(assetId).trim(),
      claimantWallet: String(claimantWallet).trim(),
      reason: String(reason).trim(),
      hashHistory: hashHistory ? String(hashHistory).trim() : "",
      timestamp: timestamp ? String(timestamp).trim() : "",
      evidenceFile: evidenceFile ? String(evidenceFile).trim() : "",
    });

    res.status(201).json({ dispute });
  } catch (error) {
    next(error);
  }
}

async function updateDisputeStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body || {};

    if (!DISPUTE_STATUSES.includes(status)) {
      return res.status(400).json({ error: "status is invalid" });
    }

    const dispute = await Dispute.findByIdAndUpdate(
      id,
      { status, adminNote: adminNote ? String(adminNote).trim() : "" },
      { new: true },
    );

    if (!dispute) {
      return res.status(404).json({ error: "Dispute not found" });
    }

    res.json({ dispute });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listDisputes,
  listDisputesForAsset,
  createDispute,
  updateDisputeStatus,
};

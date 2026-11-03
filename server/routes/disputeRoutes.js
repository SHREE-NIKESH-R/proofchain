const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  listDisputes,
  listDisputesForAsset,
  createDispute,
  updateDisputeStatus,
} = require("../controllers/disputeController");

const router = express.Router();

router.get("/", requireAuth, listDisputes);
router.get("/asset/:assetId", requireAuth, listDisputesForAsset);
router.post("/", requireAuth, createDispute);
router.patch("/:id/status", requireAuth, updateDisputeStatus);

module.exports = router;

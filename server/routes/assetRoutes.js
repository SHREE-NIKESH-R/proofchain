const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const {
  prepareRegistration,
  prepareFileRegistration,
  registerAsset,
  registerFileAsset,
  verifyContent,
  verifyFileContent,
  checkSimilarity,
  checkFileSimilarity,
  embedHiddenProof,
  extractHiddenProof,
  recordTransfer,
  listMyAssets,
  getAssetById,
} = require("../controllers/assetController");

const router = express.Router();

// Text (Prompt/Article) — Phase 1
router.post("/prepare", requireAuth, prepareRegistration);
router.post("/register", requireAuth, registerAsset);

// File-based (Image/Music/Video) — Phase 2
router.post(
  "/prepare-file",
  requireAuth,
  upload.single("file"),
  prepareFileRegistration,
);
router.post(
  "/register-file",
  requireAuth,
  upload.single("file"),
  registerFileAsset,
);

router.post("/verify", verifyContent); // public — exact-match check (text), fast path
router.post("/verify-file", upload.single("file"), verifyFileContent); // public — exact-match check (files)
router.post("/similarity-check", checkSimilarity); // public — near-duplicate check via AI service (text)
router.post(
  "/similarity-check-file",
  upload.single("file"),
  checkFileSimilarity,
); // public — same, for files
router.post("/hidden-proof/embed", embedHiddenProof); // public — text steganography proof embedding
router.post("/hidden-proof/extract", extractHiddenProof); // public — recover zero-width proof hash
router.post("/:assetId/transfer", requireAuth, recordTransfer);
router.get("/", requireAuth, listMyAssets);
router.get("/:assetId", getAssetById); // owner-agnostic detail read; UI decides what to show

module.exports = router;

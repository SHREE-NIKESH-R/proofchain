const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getMyProfile, upsertMyProfile, getPublicProfile } = require("../controllers/profileController");

const router = express.Router();

router.get("/me", requireAuth, getMyProfile);
router.put("/me", requireAuth, upsertMyProfile);
router.get("/:wallet", getPublicProfile); // public — no auth

module.exports = router;

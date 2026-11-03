const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  register,
  login,
  requestWalletNonce,
  linkWallet,
  unlinkWallet,
  me,
} = require("../controllers/authController");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, me);

router.get("/wallet/nonce", requireAuth, requestWalletNonce);
router.post("/wallet/link", requireAuth, linkWallet);
router.post("/wallet/unlink", requireAuth, unlinkWallet);

module.exports = router;

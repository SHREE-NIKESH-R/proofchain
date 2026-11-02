const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  register,
  login,
  requestWalletNonce,
  linkWallet,
  me,
} = require("../controllers/authController");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, me);

router.get("/wallet/nonce", requireAuth, requestWalletNonce);
router.post("/wallet/link", requireAuth, linkWallet);

module.exports = router;

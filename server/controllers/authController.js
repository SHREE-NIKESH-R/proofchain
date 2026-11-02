const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { ethers } = require("ethers");
const User = require("../models/User");

const SALT_ROUNDS = 12;

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function toPublicUser(user) {
  return {
    id: user._id,
    email: user.email,
    walletAddress: user.walletAddress,
    createdAt: user.createdAt,
  };
}

async function register(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({ email: email.toLowerCase(), passwordHash });

    const token = signToken(user._id);
    res.status(201).json({ token, user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signToken(user._id);
    res.json({ token, user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

// In-memory nonce store keyed by userId. Fine for local dev (Phase 1); would move to
// Mongo/Redis before any real deployment, but that's a Phase 7 concern, not now.
const walletNonces = new Map();

/**
 * Step 1 of wallet linking: issue a one-time message for the user to sign in MetaMask.
 * This proves they control the private key without ever touching it server-side.
 */
async function requestWalletNonce(req, res, next) {
  try {
    const nonce = crypto.randomBytes(16).toString("hex");
    const message = `ProofChain wallet verification\nNonce: ${nonce}\nUser: ${req.userId}`;
    walletNonces.set(req.userId, message);
    res.json({ message });
  } catch (err) {
    next(err);
  }
}

/**
 * Step 2: verify the signature matches the issued message and recovers the claimed address,
 * then links it to the authenticated account.
 */
async function linkWallet(req, res, next) {
  try {
    const { walletAddress, signature } = req.body;
    if (!walletAddress || !signature) {
      return res.status(400).json({ error: "walletAddress and signature are required" });
    }

    const expectedMessage = walletNonces.get(req.userId);
    if (!expectedMessage) {
      return res.status(400).json({ error: "No pending wallet verification request. Call /wallet/nonce first." });
    }

    const recoveredAddress = ethers.verifyMessage(expectedMessage, signature);
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(401).json({ error: "Signature does not match the provided wallet address" });
    }

    walletNonces.delete(req.userId);

    const user = await User.findByIdAndUpdate(
      req.userId,
      { walletAddress: walletAddress.toLowerCase() },
      { new: true }
    );

    res.json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, requestWalletNonce, linkWallet, me };

const Profile = require("../models/Profile");
const User = require("../models/User");
const Asset = require("../models/Asset");

async function getMyProfile(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    if (!user || !user.walletAddress) {
      return res.status(400).json({ error: "Link a wallet before setting a display name" });
    }
    const profile = await Profile.findOne({ walletAddress: user.walletAddress });
    res.json({ profile: profile || { walletAddress: user.walletAddress, displayName: null, bio: "" } });
  } catch (err) {
    next(err);
  }
}

async function upsertMyProfile(req, res, next) {
  try {
    const { displayName, bio } = req.body;
    if (!displayName || !displayName.trim()) {
      return res.status(400).json({ error: "displayName is required" });
    }
    if (displayName.trim().length > 60) {
      return res.status(400).json({ error: "displayName must be 60 characters or fewer" });
    }

    const user = await User.findById(req.userId);
    if (!user || !user.walletAddress) {
      return res.status(400).json({ error: "Link a wallet before setting a display name" });
    }

    const profile = await Profile.findOneAndUpdate(
      { walletAddress: user.walletAddress },
      { walletAddress: user.walletAddress, displayName: displayName.trim(), bio: (bio || "").trim() },
      { upsert: true, new: true }
    );

    res.json({ profile });
  } catch (err) {
    next(err);
  }
}

/** Public: anyone can view a wallet's display name, bio, and their publicly registered assets. */
async function getPublicProfile(req, res, next) {
  try {
    const walletAddress = req.params.wallet.toLowerCase();
    const profile = await Profile.findOne({ walletAddress });

    const assets = await Asset.find({ ownerWallet: walletAddress })
      .select("assetId title contentType registeredAt evidenceScore status")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      walletAddress,
      displayName: profile ? profile.displayName : null,
      bio: profile ? profile.bio : "",
      assets,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMyProfile, upsertMyProfile, getPublicProfile };

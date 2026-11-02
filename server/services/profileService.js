const Profile = require("../models/Profile");

/**
 * Resolves a single wallet to {walletAddress, displayName}. displayName is null when
 * no profile has been set — callers must fall back to showing the raw wallet address,
 * never fabricate a name.
 */
async function resolveDisplayName(walletAddress) {
  if (!walletAddress) return { walletAddress, displayName: null };
  const profile = await Profile.findOne({ walletAddress: walletAddress.toLowerCase() });
  return { walletAddress, displayName: profile ? profile.displayName : null };
}

/**
 * Batch version — used when rendering a list of assets (e.g. My Assets, Explorer search
 * results) so we don't run one query per row.
 */
async function resolveDisplayNames(walletAddresses) {
  const unique = [...new Set(walletAddresses.filter(Boolean).map((w) => w.toLowerCase()))];
  if (unique.length === 0) return {};
  const profiles = await Profile.find({ walletAddress: { $in: unique } });
  const map = {};
  for (const w of unique) map[w] = null;
  for (const p of profiles) map[p.walletAddress] = p.displayName;
  return map;
}

module.exports = { resolveDisplayName, resolveDisplayNames };

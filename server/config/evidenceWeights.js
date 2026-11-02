// Weights for the Creative Evidence Score (spec Section 8).
// Must sum to 1.0 — enforced by a check in evidenceScoreService.js so a bad
// config fails loudly at startup rather than silently producing a skewed score.
//
// Override any value via environment variables (e.g. EVIDENCE_WEIGHT_SIMILARITY=0.3)
// without redeploying code, per the spec's "make the weights configurable" requirement.
function envFloat(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = parseFloat(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const weights = {
  registrationHistory: envFloat("EVIDENCE_WEIGHT_REGISTRATION", 0.25),
  ownershipProof: envFloat("EVIDENCE_WEIGHT_OWNERSHIP", 0.2),
  similarity: envFloat("EVIDENCE_WEIGHT_SIMILARITY", 0.25),
  versionHistory: envFloat("EVIDENCE_WEIGHT_VERSION_HISTORY", 0.15),
  aiModelMetadata: envFloat("EVIDENCE_WEIGHT_AI_MODEL", 0.15),
};

module.exports = { weights };

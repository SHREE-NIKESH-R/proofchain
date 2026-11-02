const { weights } = require("../config/evidenceWeights");

const WEIGHT_SUM = Object.values(weights).reduce((a, b) => a + b, 0);
if (Math.abs(WEIGHT_SUM - 1.0) > 0.001) {
  throw new Error(
    `Evidence score weights must sum to 1.0, got ${WEIGHT_SUM}. Check EVIDENCE_WEIGHT_* env vars.`
  );
}

const STRONG = "Strong";
const MODERATE = "Moderate";
const WEAK = "Weak";
const AVAILABLE = "Available";
const NOT_AVAILABLE = "Not Available";

/**
 * Registration history factor: is there a confirmed, matching on-chain record?
 * This is the closest thing to a "hard" factor — either the chain confirms it or it doesn't.
 */
function scoreRegistrationHistory(onChainAsset, asset) {
  if (!onChainAsset || !onChainAsset.active) {
    return { subscore: 0.0, label: WEAK, detail: "No active on-chain record found" };
  }
  const hashMatches = onChainAsset.contentHash?.toLowerCase() === asset.contentHash?.toLowerCase();
  if (!hashMatches) {
    return { subscore: 0.3, label: WEAK, detail: "On-chain record found but content hash does not match" };
  }
  return { subscore: 1.0, label: STRONG, detail: "Blockchain registration confirmed and hash-matched" };
}

/**
 * Ownership proof factor: does the current on-chain owner match our stored owner?
 * A mismatch usually means a transfer happened on-chain that we haven't synced yet,
 * or (rarely) something more concerning — either way it should visibly lower the score.
 */
function scoreOwnershipProof(onChainAsset, asset) {
  if (!onChainAsset) {
    return { subscore: 0.0, label: WEAK, detail: "No on-chain owner to verify against" };
  }
  const ownerMatches = onChainAsset.owner?.toLowerCase() === asset.ownerWallet?.toLowerCase();
  if (!ownerMatches) {
    return { subscore: 0.4, label: MODERATE, detail: "Stored owner does not match current on-chain owner" };
  }
  return { subscore: 1.0, label: STRONG, detail: "Stored owner matches current on-chain owner" };
}

/**
 * Similarity factor: lower similarity to existing registered content is stronger evidence
 * of originality. If no analysis has run yet, this is explicitly "Not Available" rather
 * than silently defaulting to a score that looks like a real result — an unanalyzed asset
 * should never look more or less original than it actually is.
 */
function scoreSimilarity(originalityAnalysis) {
  if (!originalityAnalysis || typeof originalityAnalysis.similarityScore !== "number") {
    return { subscore: null, label: NOT_AVAILABLE, detail: "Originality analysis has not run for this asset" };
  }

  const similarity = originalityAnalysis.similarityScore;
  const subscore = 1.0 - similarity; // low similarity to others => strong originality evidence

  let label;
  if (similarity >= 0.85) label = WEAK;
  else if (similarity >= 0.5) label = MODERATE;
  else label = STRONG;

  return {
    subscore,
    label,
    detail: `${(similarity * 100).toFixed(1)}% similarity to closest registered match`,
  };
}

/**
 * Version/ownership history factor: rewards a clean, verifiable trail (on-chain history
 * length matches our records) rather than simply rewarding "more transfers" as inherently
 * better — a single-owner asset with a consistent record is not weaker evidence than a
 * heavily-transferred one, just different.
 */
function scoreVersionHistory(ownershipHistoryCount, onChainOwnershipHistoryCount) {
  if (onChainOwnershipHistoryCount === null || onChainOwnershipHistoryCount === undefined) {
    return { subscore: 0.5, label: MODERATE, detail: "On-chain ownership history unavailable to cross-check" };
  }
  // +1 because the original registration itself counts as the first entry in both trails.
  const expected = ownershipHistoryCount + 1;
  const consistent = expected === onChainOwnershipHistoryCount;
  if (!consistent) {
    return {
      subscore: 0.4,
      label: WEAK,
      detail: `Recorded history (${expected} entries) does not match on-chain history (${onChainOwnershipHistoryCount} entries)`,
    };
  }
  return { subscore: 1.0, label: STRONG, detail: `Ownership history consistent (${onChainOwnershipHistoryCount} entries, on-chain-verified)` };
}

/**
 * AI model metadata factor: simply whether the creator declared a model, since this is
 * user-provided transparency metadata, not a verified fact (spec Section 9).
 */
function scoreAiModelMetadata(aiModel) {
  if (!aiModel || aiModel === "Human-created / Unknown") {
    return { subscore: 0.6, label: NOT_AVAILABLE, detail: "No specific AI model declared" };
  }
  return { subscore: 1.0, label: AVAILABLE, detail: `Declared model: ${aiModel}` };
}

/**
 * Computes the full Creative Evidence Score (0-100) with a transparent per-factor
 * breakdown, per spec Section 8. This is an evidence indicator, not a legal
 * copyright/originality determination — see the `disclaimer` field on the result.
 *
 * All inputs are plain data (no DB/network calls) so this is fully unit-testable.
 */
function computeEvidenceScore({
  asset,
  onChainAsset,
  ownershipHistoryCount = 0,
  onChainOwnershipHistoryCount = null,
  originalityAnalysis = null,
}) {
  const factors = {
    registrationHistory: scoreRegistrationHistory(onChainAsset, asset),
    ownershipProof: scoreOwnershipProof(onChainAsset, asset),
    similarity: scoreSimilarity(originalityAnalysis),
    versionHistory: scoreVersionHistory(ownershipHistoryCount, onChainOwnershipHistoryCount),
    aiModelMetadata: scoreAiModelMetadata(asset.aiModel),
  };

  // Factors with subscore === null (not yet available) are excluded from the weighted
  // sum and their weight is redistributed proportionally across the remaining factors,
  // rather than silently treating "unknown" as either 0 or a neutral guess.
  const availableKeys = Object.keys(factors).filter((k) => factors[k].subscore !== null);
  const availableWeightSum = availableKeys.reduce((sum, k) => sum + weights[k], 0);

  let weightedSum = 0;
  for (const key of availableKeys) {
    const normalizedWeight = weights[key] / availableWeightSum;
    weightedSum += factors[key].subscore * normalizedWeight;
  }

  const score = Math.round(weightedSum * 100);

  return {
    score,
    factors,
    weights,
    disclaimer:
      "This is a technical evidence indicator based on blockchain and similarity data, not a legal determination of originality or copyright ownership.",
  };
}

module.exports = { computeEvidenceScore };

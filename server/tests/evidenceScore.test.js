const { computeEvidenceScore } = require("../services/evidenceScoreService");

const baseAsset = {
  contentHash: "0xabc123",
  ownerWallet: "0xowner",
  aiModel: "Human-created / Unknown",
};

const matchingOnChainAsset = {
  active: true,
  contentHash: "0xabc123",
  owner: "0xowner",
};

describe("computeEvidenceScore", () => {
  it("returns a high score when every factor is strong", () => {
    const result = computeEvidenceScore({
      asset: { ...baseAsset, aiModel: "ChatGPT" },
      onChainAsset: matchingOnChainAsset,
      ownershipHistoryCount: 0,
      onChainOwnershipHistoryCount: 1,
      originalityAnalysis: { similarityScore: 0.1 },
    });

    expect(result.score).toBeGreaterThan(85);
    expect(result.factors.registrationHistory.label).toBe("Strong");
    expect(result.factors.ownershipProof.label).toBe("Strong");
    expect(result.factors.similarity.label).toBe("Strong");
    expect(result.factors.versionHistory.label).toBe("Strong");
    expect(result.factors.aiModelMetadata.label).toBe("Available");
  });

  it("returns a low score when the on-chain record is missing or inactive", () => {
    const result = computeEvidenceScore({
      asset: baseAsset,
      onChainAsset: null,
      ownershipHistoryCount: 0,
      onChainOwnershipHistoryCount: null,
      originalityAnalysis: null,
    });

    expect(result.factors.registrationHistory.subscore).toBe(0.0);
    expect(result.factors.registrationHistory.label).toBe("Weak");
    expect(result.score).toBeLessThan(50);
  });

  it("flags a content hash mismatch as weak evidence even with an active on-chain record", () => {
    const result = computeEvidenceScore({
      asset: baseAsset,
      onChainAsset: { active: true, contentHash: "0xDIFFERENT", owner: "0xowner" },
      originalityAnalysis: null,
    });
    expect(result.factors.registrationHistory.label).toBe("Weak");
  });

  it("flags an owner mismatch between stored and on-chain owner", () => {
    const result = computeEvidenceScore({
      asset: baseAsset,
      onChainAsset: { active: true, contentHash: "0xabc123", owner: "0xSOMEONE_ELSE" },
      originalityAnalysis: null,
    });
    expect(result.factors.ownershipProof.label).toBe("Moderate");
    expect(result.factors.ownershipProof.subscore).toBeLessThan(1.0);
  });

  it('marks similarity as "Not Available" rather than guessing when analysis has not run', () => {
    const result = computeEvidenceScore({
      asset: baseAsset,
      onChainAsset: matchingOnChainAsset,
      originalityAnalysis: null,
    });
    expect(result.factors.similarity.subscore).toBeNull();
    expect(result.factors.similarity.label).toBe("Not Available");
  });

  it("redistributes weight away from an unavailable factor rather than treating it as a bad result", () => {
    const withoutAnalysis = computeEvidenceScore({
      asset: { ...baseAsset, aiModel: "ChatGPT" },
      onChainAsset: matchingOnChainAsset,
      ownershipHistoryCount: 0,
      onChainOwnershipHistoryCount: 1,
      originalityAnalysis: null,
    });
    const withWeakAnalysis = computeEvidenceScore({
      asset: { ...baseAsset, aiModel: "ChatGPT" },
      onChainAsset: matchingOnChainAsset,
      ownershipHistoryCount: 0,
      onChainOwnershipHistoryCount: 1,
      originalityAnalysis: { similarityScore: 0.9 }, // high similarity = weak originality evidence
    });
    // Not having run analysis yet ("unknown") should score better than having run it and
    // gotten a genuinely weak (high-similarity) result — "unknown" isn't treated as "bad".
    expect(withoutAnalysis.score).toBeGreaterThan(withWeakAnalysis.score);
  });

  it("labels high similarity to an existing asset as weak originality evidence", () => {
    const result = computeEvidenceScore({
      asset: baseAsset,
      onChainAsset: matchingOnChainAsset,
      originalityAnalysis: { similarityScore: 0.93 },
    });
    expect(result.factors.similarity.label).toBe("Weak");
    expect(result.factors.similarity.subscore).toBeCloseTo(0.07, 2);
  });

  it("flags inconsistent ownership history between DB and chain", () => {
    const result = computeEvidenceScore({
      asset: baseAsset,
      onChainAsset: matchingOnChainAsset,
      ownershipHistoryCount: 2, // expects on-chain history length 3
      onChainOwnershipHistoryCount: 5, // but chain says 5
      originalityAnalysis: null,
    });
    expect(result.factors.versionHistory.label).toBe("Weak");
  });

  it("treats an undeclared AI model as Not Available, not a penalty-free default", () => {
    const result = computeEvidenceScore({
      asset: { ...baseAsset, aiModel: "Human-created / Unknown" },
      onChainAsset: matchingOnChainAsset,
      originalityAnalysis: null,
    });
    expect(result.factors.aiModelMetadata.label).toBe("Not Available");
    expect(result.factors.aiModelMetadata.subscore).toBeLessThan(1.0);
  });

  it("always returns a score between 0 and 100", () => {
    const worst = computeEvidenceScore({
      asset: { contentHash: "0x1", ownerWallet: "0x1", aiModel: null },
      onChainAsset: null,
      ownershipHistoryCount: 0,
      onChainOwnershipHistoryCount: null,
      originalityAnalysis: { similarityScore: 1.0 },
    });
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(100);
  });

  it("includes the non-legal disclaimer on every result", () => {
    const result = computeEvidenceScore({ asset: baseAsset, onChainAsset: null });
    expect(result.disclaimer).toMatch(/not a legal determination/i);
  });

  it("includes the weights used, for full transparency", () => {
    const result = computeEvidenceScore({ asset: baseAsset, onChainAsset: null });
    const sum = Object.values(result.weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 3);
  });
});

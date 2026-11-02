process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

jest.mock("../services/blockchainService");
jest.mock("../services/aiService");

const request = require("supertest");
const { ethers } = require("ethers");
const createApp = require("../app");
const blockchainService = require("../services/blockchainService");
const aiService = require("../services/aiService");
const Asset = require("../models/Asset");
const { setupTestDB, teardownTestDB, clearTestDB } = require("./setup");

const app = createApp();

beforeAll(setupTestDB);
afterAll(teardownTestDB);
afterEach(clearTestDB);
afterEach(() => jest.clearAllMocks());

async function registerAndLinkWallet() {
  const credentials = { email: `creator+${Date.now()}@example.com`, password: "supersecure123" };
  const registerRes = await request(app).post("/api/auth/register").send(credentials);
  const token = registerRes.body.token;

  const wallet = ethers.Wallet.createRandom();
  const nonceRes = await request(app).get("/api/auth/wallet/nonce").set("Authorization", `Bearer ${token}`);
  const signature = await wallet.signMessage(nonceRes.body.message);
  await request(app)
    .post("/api/auth/wallet/link")
    .set("Authorization", `Bearer ${token}`)
    .send({ walletAddress: wallet.address, signature });

  return { token, wallet };
}

describe("Asset API — Phase 1 (Prompt/Article)", () => {
  it("prepares registration by computing a deterministic content hash", async () => {
    const { token } = await registerAndLinkWallet();

    const res = await request(app)
      .post("/api/assets/prepare")
      .set("Authorization", `Bearer ${token}`)
      .send({ contentType: "article", textContent: "AI is transforming how students learn." });

    expect(res.status).toBe(200);
    expect(res.body.contentHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(res.body.assetId).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("rejects prepare for unsupported content types in Phase 1", async () => {
    const { token } = await registerAndLinkWallet();
    const res = await request(app)
      .post("/api/assets/prepare")
      .set("Authorization", `Bearer ${token}`)
      .send({ contentType: "image", textContent: "n/a" });
    expect(res.status).toBe(400);
  });

  it("registers an asset after independently confirming the on-chain record", async () => {
    const { token, wallet } = await registerAndLinkWallet();
    const textContent = "Artificial intelligence is changing education.";

    const prep = await request(app)
      .post("/api/assets/prepare")
      .set("Authorization", `Bearer ${token}`)
      .send({ contentType: "article", textContent });

    const { contentHash, assetId } = prep.body;

    blockchainService.confirmTransaction.mockResolvedValue({ confirmed: true });
    blockchainService.readAssetOnChain.mockResolvedValue({
      assetId,
      contentHash,
      owner: wallet.address,
      registeredBy: wallet.address,
      timestamp: Math.floor(Date.now() / 1000),
      contentType: "article",
      aiModel: "ChatGPT",
      active: true,
    });

    const res = await request(app)
      .post("/api/assets/register")
      .set("Authorization", `Bearer ${token}`)
      .send({
        assetId,
        contentHash,
        txHash: "0x" + "a".repeat(64),
        title: "AI and Education",
        description: "Short article about AI in classrooms.",
        contentType: "article",
        textContent,
        aiModel: "ChatGPT",
      });

    expect(res.status).toBe(201);
    expect(res.body.asset.assetId).toBe(assetId);
    expect(res.body.asset.ownerWallet.toLowerCase()).toBe(wallet.address.toLowerCase());
  });

  it("stores originality analysis returned by the AI service on registration", async () => {
    const { token, wallet } = await registerAndLinkWallet();
    const textContent = "A distinct article for originality analysis testing.";

    const prep = await request(app)
      .post("/api/assets/prepare")
      .set("Authorization", `Bearer ${token}`)
      .send({ contentType: "article", textContent });
    const { contentHash, assetId } = prep.body;

    blockchainService.confirmTransaction.mockResolvedValue({ confirmed: true });
    blockchainService.readAssetOnChain.mockResolvedValue({
      assetId,
      contentHash,
      owner: wallet.address,
      registeredBy: wallet.address,
      timestamp: Math.floor(Date.now() / 1000),
      contentType: "article",
      aiModel: "ChatGPT",
      active: true,
    });

    aiService.analyzeText.mockResolvedValue({
      similarityScore: 0.42,
      matchedAssets: [],
      analysisMethod: "Semantic Embedding",
      confidence: "moderate",
      warning: null,
    });

    const res = await request(app)
      .post("/api/assets/register")
      .set("Authorization", `Bearer ${token}`)
      .send({
        assetId,
        contentHash,
        txHash: "0x" + "9".repeat(64),
        title: "Originality Test Article",
        contentType: "article",
        textContent,
      });

    expect(res.status).toBe(201);
    expect(aiService.analyzeText).toHaveBeenCalledWith(assetId, textContent, "article");

    const stored = await Asset.findOne({ assetId });
    expect(stored.originalityAnalysis.similarityScore).toBe(0.42);
    expect(stored.originalityAnalysis.analysisMethod).toBe("Semantic Embedding");
  });

  it("still registers the asset successfully even if the AI service fails", async () => {
    const { token, wallet } = await registerAndLinkWallet();
    const textContent = "This article's originality analysis will fail.";

    const prep = await request(app)
      .post("/api/assets/prepare")
      .set("Authorization", `Bearer ${token}`)
      .send({ contentType: "article", textContent });
    const { contentHash, assetId } = prep.body;

    blockchainService.confirmTransaction.mockResolvedValue({ confirmed: true });
    blockchainService.readAssetOnChain.mockResolvedValue({
      assetId,
      contentHash,
      owner: wallet.address,
      registeredBy: wallet.address,
      timestamp: Math.floor(Date.now() / 1000),
      contentType: "article",
      aiModel: "Other",
      active: true,
    });

    aiService.analyzeText.mockRejectedValue(new Error("AI service unreachable"));

    const res = await request(app)
      .post("/api/assets/register")
      .set("Authorization", `Bearer ${token}`)
      .send({
        assetId,
        contentHash,
        txHash: "0x" + "8".repeat(64),
        title: "Resilience Test Article",
        contentType: "article",
        textContent,
      });

    // Registration is blockchain-confirmed and must succeed regardless of AI service health.
    expect(res.status).toBe(201);
    const stored = await Asset.findOne({ assetId });
    expect(stored.originalityAnalysis).toBeNull();
  });

  it("similarity-check runs an ad-hoc, non-persisted analysis without requiring auth", async () => {
    aiService.analyzeText.mockResolvedValue({
      similarityScore: 0.91,
      matchedAssets: [{ assetId: "asset-existing", similarityScore: 0.91 }],
      analysisMethod: "Semantic Embedding",
      confidence: "moderate",
      warning: "Possible Derivative Work",
    });

    const res = await request(app)
      .post("/api/assets/similarity-check")
      .send({ textContent: "Some prompt text to check.", contentType: "prompt" });

    expect(res.status).toBe(200);
    expect(res.body.analysis.warning).toBe("Possible Derivative Work");

    // Confirms the probe assetId was passed with persist=false.
    const callArgs = aiService.analyzeText.mock.calls[0];
    expect(callArgs[0]).toMatch(/^probe-/);
    expect(callArgs[3]).toBe(false);
  });

  it("similarity-check rejects missing or unsupported content types", async () => {
    const res = await request(app)
      .post("/api/assets/similarity-check")
      .send({ textContent: "text", contentType: "image" });
    expect(res.status).toBe(400);
  });

  it("rejects registration when the on-chain owner doesn't match the linked wallet", async () => {
    const { token } = await registerAndLinkWallet();
    const attacker = ethers.Wallet.createRandom();
    const textContent = "Some article content.";

    const prep = await request(app)
      .post("/api/assets/prepare")
      .set("Authorization", `Bearer ${token}`)
      .send({ contentType: "article", textContent });
    const { contentHash, assetId } = prep.body;

    blockchainService.confirmTransaction.mockResolvedValue({ confirmed: true });
    blockchainService.readAssetOnChain.mockResolvedValue({
      assetId,
      contentHash,
      owner: attacker.address, // mismatched owner
      registeredBy: attacker.address,
      timestamp: Math.floor(Date.now() / 1000),
      contentType: "article",
      aiModel: "Other",
      active: true,
    });

    const res = await request(app)
      .post("/api/assets/register")
      .set("Authorization", `Bearer ${token}`)
      .send({
        assetId,
        contentHash,
        txHash: "0x" + "b".repeat(64),
        title: "Mismatched Owner Article",
        contentType: "article",
        textContent,
      });

    expect(res.status).toBe(422);
  });

  it("detects an exact match on verification and reports no match for unregistered content", async () => {
    const { token, wallet } = await registerAndLinkWallet();
    const textContent = "A unique piece of writing for verification testing.";

    const prep = await request(app)
      .post("/api/assets/prepare")
      .set("Authorization", `Bearer ${token}`)
      .send({ contentType: "article", textContent });
    const { contentHash, assetId } = prep.body;

    blockchainService.confirmTransaction.mockResolvedValue({ confirmed: true });
    blockchainService.readAssetOnChain.mockResolvedValue({
      assetId,
      contentHash,
      owner: wallet.address,
      registeredBy: wallet.address,
      timestamp: Math.floor(Date.now() / 1000),
      contentType: "article",
      aiModel: "Other",
      active: true,
    });

    await request(app)
      .post("/api/assets/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ assetId, contentHash, txHash: "0x" + "c".repeat(64), title: "Verification Test", contentType: "article", textContent });

    const matchRes = await request(app).post("/api/assets/verify").send({ textContent });
    expect(matchRes.body.exactMatch).toBe(true);

    const noMatchRes = await request(app)
      .post("/api/assets/verify")
      .send({ textContent: "Completely different, never-registered text." });
    expect(noMatchRes.body.exactMatch).toBe(false);
  });

  it("computes and stores an evidence score on registration", async () => {
    const { token, wallet } = await registerAndLinkWallet();
    const textContent = "An article used to verify evidence score computation.";

    const prep = await request(app)
      .post("/api/assets/prepare")
      .set("Authorization", `Bearer ${token}`)
      .send({ contentType: "article", textContent });
    const { contentHash, assetId } = prep.body;

    blockchainService.confirmTransaction.mockResolvedValue({ confirmed: true });
    blockchainService.readAssetOnChain.mockResolvedValue({
      assetId,
      contentHash,
      owner: wallet.address,
      registeredBy: wallet.address,
      timestamp: Math.floor(Date.now() / 1000),
      contentType: "article",
      aiModel: "ChatGPT",
      active: true,
    });
    blockchainService.readOwnershipHistoryOnChain.mockResolvedValue([wallet.address]);
    aiService.analyzeText.mockResolvedValue({
      similarityScore: 0.1,
      matchedAssets: [],
      analysisMethod: "Semantic Embedding",
      confidence: "low",
      warning: null,
    });

    const res = await request(app)
      .post("/api/assets/register")
      .set("Authorization", `Bearer ${token}`)
      .send({
        assetId,
        contentHash,
        txHash: "0x" + "7".repeat(64),
        title: "Evidence Score Test",
        contentType: "article",
        textContent,
        aiModel: "ChatGPT",
      });

    expect(res.status).toBe(201);
    expect(res.body.asset.evidenceScore).toBeGreaterThan(0);
    expect(res.body.asset.evidenceScoreBreakdown.factors.registrationHistory.label).toBe("Strong");
    expect(res.body.asset.evidenceScoreBreakdown.disclaimer).toMatch(/not a legal determination/i);
  });

  it("returns a freshly computed evidence score on asset detail reads", async () => {
    const { token, wallet } = await registerAndLinkWallet();
    const textContent = "Detail page evidence score freshness test.";

    const prep = await request(app)
      .post("/api/assets/prepare")
      .set("Authorization", `Bearer ${token}`)
      .send({ contentType: "prompt", textContent });
    const { contentHash, assetId } = prep.body;

    blockchainService.confirmTransaction.mockResolvedValue({ confirmed: true });
    blockchainService.readAssetOnChain.mockResolvedValue({
      assetId,
      contentHash,
      owner: wallet.address,
      registeredBy: wallet.address,
      timestamp: Math.floor(Date.now() / 1000),
      contentType: "prompt",
      aiModel: "Other",
      active: true,
    });
    blockchainService.readOwnershipHistoryOnChain.mockResolvedValue([wallet.address]);
    aiService.analyzeText.mockResolvedValue({
      similarityScore: 0.2,
      matchedAssets: [],
      analysisMethod: "Semantic Embedding",
      confidence: "low",
      warning: null,
    });

    await request(app)
      .post("/api/assets/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ assetId, contentHash, txHash: "0x" + "6".repeat(64), title: "Freshness Test", contentType: "prompt", textContent });

    const detailRes = await request(app).get(`/api/assets/${assetId}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.evidenceScore.score).toBeGreaterThan(0);
    expect(detailRes.body.evidenceScore.factors).toHaveProperty("similarity");
  });

  it("records an ownership transfer after confirming it on-chain", async () => {
    const { token, wallet } = await registerAndLinkWallet();
    const recipient = await registerAndLinkWallet();
    const newOwner = recipient.wallet;
    const textContent = "Content that will change hands.";

    const prep = await request(app)
      .post("/api/assets/prepare")
      .set("Authorization", `Bearer ${token}`)
      .send({ contentType: "prompt", textContent });
    const { contentHash, assetId } = prep.body;

    blockchainService.confirmTransaction.mockResolvedValue({ confirmed: true });
    blockchainService.readAssetOnChain.mockResolvedValue({
      assetId,
      contentHash,
      owner: wallet.address,
      registeredBy: wallet.address,
      timestamp: Math.floor(Date.now() / 1000),
      contentType: "prompt",
      aiModel: "Other",
      active: true,
    });

    await request(app)
      .post("/api/assets/register")
      .set("Authorization", `Bearer ${token}`)
      .send({ assetId, contentHash, txHash: "0x" + "d".repeat(64), title: "Transferable Prompt", contentType: "prompt", textContent });

    // Now simulate the transfer having happened on-chain.
    blockchainService.readAssetOnChain.mockResolvedValue({
      assetId,
      contentHash,
      owner: newOwner.address,
      registeredBy: wallet.address,
      timestamp: Math.floor(Date.now() / 1000),
      contentType: "prompt",
      aiModel: "Other",
      active: true,
    });

    const transferRes = await request(app)
      .post(`/api/assets/${assetId}/transfer`)
      .set("Authorization", `Bearer ${token}`)
      .send({ toWallet: newOwner.address, txHash: "0x" + "e".repeat(64) });

    expect(transferRes.status).toBe(200);
    expect(transferRes.body.asset.ownerWallet.toLowerCase()).toBe(newOwner.address.toLowerCase());
    expect(transferRes.body.asset.status).toBe("transferred");

    const recipientAssetsRes = await request(app)
      .get("/api/assets")
      .set("Authorization", `Bearer ${recipient.token}`);
    expect(recipientAssetsRes.status).toBe(200);
    expect(recipientAssetsRes.body.assets.map((asset) => asset.assetId)).toContain(assetId);

    const creatorAssetsRes = await request(app)
      .get("/api/assets")
      .set("Authorization", `Bearer ${token}`);
    expect(creatorAssetsRes.status).toBe(200);
    expect(creatorAssetsRes.body.assets.map((asset) => asset.assetId)).toContain(assetId);
  });
});

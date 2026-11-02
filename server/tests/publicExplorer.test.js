process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

jest.mock("../services/blockchainService");
jest.mock("../services/aiService");

const request = require("supertest");
const { ethers } = require("ethers");
const createApp = require("../app");
const blockchainService = require("../services/blockchainService");
const aiService = require("../services/aiService");
const { setupTestDB, teardownTestDB, clearTestDB } = require("./setup");

const app = createApp();

beforeAll(setupTestDB);
afterAll(teardownTestDB);
afterEach(clearTestDB);
afterEach(() => jest.clearAllMocks());

async function registerAndLinkWallet() {
  const credentials = { email: `explorer+${Date.now()}@example.com`, password: "supersecure123" };
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

async function registerTestAsset(token, wallet, textContent, contentType = "article") {
  const prep = await request(app)
    .post("/api/assets/prepare")
    .set("Authorization", `Bearer ${token}`)
    .send({ contentType, textContent });
  const { contentHash, assetId } = prep.body;

  blockchainService.confirmTransaction.mockResolvedValue({ confirmed: true });
  blockchainService.readAssetOnChain.mockResolvedValue({
    assetId,
    contentHash,
    owner: wallet.address,
    registeredBy: wallet.address,
    timestamp: Math.floor(Date.now() / 1000),
    contentType,
    aiModel: "Other",
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
    .send({ assetId, contentHash, txHash: "0x" + "1".repeat(64), title: "Explorer Test Asset", contentType, textContent });

  return res.body.asset;
}

describe("Public Explorer search", () => {
  it("finds an asset by exact assetId", async () => {
    const { token, wallet } = await registerAndLinkWallet();
    const asset = await registerTestAsset(token, wallet, "Explorer search by assetId test.");

    const res = await request(app).get(`/api/public/search?query=${asset.assetId}`);
    expect(res.status).toBe(200);
    expect(res.body.found).toBe(true);
    expect(res.body.assets[0].assetId).toBe(asset.assetId);
  });

  it("finds an asset by content hash", async () => {
    const { token, wallet } = await registerAndLinkWallet();
    const asset = await registerTestAsset(token, wallet, "Explorer search by hash test.");

    const res = await request(app).get(`/api/public/search?query=${asset.contentHash}`);
    expect(res.body.found).toBe(true);
    expect(res.body.assets[0].assetId).toBe(asset.assetId);
  });

  it("finds all assets owned by a wallet address", async () => {
    const { token, wallet } = await registerAndLinkWallet();
    await registerTestAsset(token, wallet, "First asset for wallet search.");
    await registerTestAsset(token, wallet, "Second asset for wallet search.");

    const res = await request(app).get(`/api/public/search?query=${wallet.address}`);
    expect(res.body.found).toBe(true);
    expect(res.body.assets.length).toBe(2);
  });

  it("finds an asset by blockchain transaction hash", async () => {
    const { token, wallet } = await registerAndLinkWallet();
    const asset = await registerTestAsset(token, wallet, "Explorer search by tx hash test.");

    const res = await request(app).get(`/api/public/search?query=${asset.blockchainTxHash}`);
    expect(res.body.found).toBe(true);
    expect(res.body.assets[0].assetId).toBe(asset.assetId);
  });

  it("returns found:false for an unmatched query, not a 404", async () => {
    const res = await request(app).get("/api/public/search?query=0xnonexistent");
    expect(res.status).toBe(200);
    expect(res.body.found).toBe(false);
    expect(res.body.assets).toEqual([]);
  });

  it("rejects an empty query", async () => {
    const res = await request(app).get("/api/public/search?query=");
    expect(res.status).toBe(400);
  });

  it("never exposes private fields like userId or description", async () => {
    const { token, wallet } = await registerAndLinkWallet();
    const asset = await registerTestAsset(token, wallet, "Privacy projection test.");

    const res = await request(app).get(`/api/public/search?query=${asset.assetId}`);
    expect(res.body.assets[0].userId).toBeUndefined();
    expect(res.body.assets[0].textContent).toBeUndefined();
  });
});

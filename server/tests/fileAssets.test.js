process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

jest.mock("../services/blockchainService");
jest.mock("../services/aiService");

const request = require("supertest");
const fs = require("fs");
const { ethers } = require("ethers");
const createApp = require("../app");
const blockchainService = require("../services/blockchainService");
const aiService = require("../services/aiService");
const storageService = require("../services/storageService");
const { sha256Buffer } = require("../utils/hash");
const Asset = require("../models/Asset");
const { setupTestDB, teardownTestDB, clearTestDB } = require("./setup");

const app = createApp();

beforeAll(setupTestDB);
afterAll(() => {
  teardownTestDB();
  if (fs.existsSync(storageService.UPLOAD_DIR)) {
    fs.rmSync(storageService.UPLOAD_DIR, { recursive: true, force: true });
  }
});
afterEach(clearTestDB);
afterEach(() => jest.clearAllMocks());

async function registerAndLinkWallet() {
  const credentials = { email: `filetest+${Date.now()}+${Math.random()}@example.com`, password: "supersecure123" };
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

function fakeImageBuffer(seed = "a") {
  // Real image decoding happens in the AI service (mocked here), not the Node backend —
  // the Node layer only hashes and stores bytes, so arbitrary bytes are fine for these tests.
  return Buffer.from(`fake-jpeg-bytes-${seed}-${"x".repeat(50)}`);
}

describe("Image/Music/Video registration flow", () => {
  it("prepares a file registration by hashing the uploaded bytes", async () => {
    const { token } = await registerAndLinkWallet();
    const buffer = fakeImageBuffer("prep");

    const res = await request(app)
      .post("/api/assets/prepare-file")
      .set("Authorization", `Bearer ${token}`)
      .field("contentType", "image")
      .attach("file", buffer, { filename: "photo.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(200);
    expect(res.body.contentHash).toBe(sha256Buffer(buffer));
    expect(res.body.assetId).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("rejects an oversized or wrong-mimetype file at the prepare step", async () => {
    const { token } = await registerAndLinkWallet();
    const res = await request(app)
      .post("/api/assets/prepare-file")
      .set("Authorization", `Bearer ${token}`)
      .field("contentType", "image")
      .attach("file", Buffer.from("not an image"), { filename: "doc.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(415);
  });

  it("registers an image end-to-end: hash verified, file stored, AI analysis run, evidence score computed", async () => {
    const { token, wallet } = await registerAndLinkWallet();
    const buffer = fakeImageBuffer("register");
    const contentHash = sha256Buffer(buffer);

    blockchainService.confirmTransaction.mockResolvedValue({ confirmed: true });
    blockchainService.readAssetOnChain.mockResolvedValue({
      contentHash,
      owner: wallet.address,
      registeredBy: wallet.address,
      timestamp: Math.floor(Date.now() / 1000),
      contentType: "image",
      aiModel: "Midjourney",
      active: true,
    });
    blockchainService.readOwnershipHistoryOnChain.mockResolvedValue([wallet.address]);
    aiService.analyzeImage.mockResolvedValue({
      similarityScore: 0.05,
      matchedAssets: [],
      analysisMethod: "Perceptual Hash",
      confidence: "low",
      warning: null,
    });

    const prep = await request(app)
      .post("/api/assets/prepare-file")
      .set("Authorization", `Bearer ${token}`)
      .field("contentType", "image")
      .attach("file", buffer, { filename: "art.jpg", contentType: "image/jpeg" });

    const res = await request(app)
      .post("/api/assets/register-file")
      .set("Authorization", `Bearer ${token}`)
      .field("assetId", prep.body.assetId)
      .field("contentHash", prep.body.contentHash)
      .field("txHash", "0x" + "a".repeat(64))
      .field("title", "AI Artwork")
      .field("contentType", "image")
      .field("aiModel", "Midjourney")
      .attach("file", buffer, { filename: "art.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(201);
    expect(res.body.asset.fileUrl).toMatch(/^\/uploads\/.+\.jpg$/);
    expect(res.body.asset.contentHash).toBe(contentHash);
    expect(res.body.asset.evidenceScore).toBeGreaterThan(0);
    expect(aiService.analyzeImage).toHaveBeenCalled();

    // The file must actually be retrievable from local disk (real StorageService, not mocked).
    const storedPath = `${storageService.UPLOAD_DIR}/${res.body.asset.fileUrl.replace("/uploads/", "")}`;
    expect(fs.existsSync(storedPath)).toBe(true);
    expect(fs.readFileSync(storedPath)).toEqual(buffer);
  });

  it("rejects registration if the uploaded file's hash doesn't match the claimed hash", async () => {
    const { token, wallet } = await registerAndLinkWallet();
    const originalBuffer = fakeImageBuffer("original");
    const tamperedBuffer = fakeImageBuffer("tampered");

    blockchainService.confirmTransaction.mockResolvedValue({ confirmed: true });

    const res = await request(app)
      .post("/api/assets/register-file")
      .set("Authorization", `Bearer ${token}`)
      .field("assetId", "0x" + "1".repeat(64))
      .field("contentHash", sha256Buffer(originalBuffer)) // claims the original's hash
      .field("txHash", "0x" + "b".repeat(64))
      .field("title", "Tamper Test")
      .field("contentType", "image")
      .attach("file", tamperedBuffer, { filename: "art.jpg", contentType: "image/jpeg" }); // uploads different bytes

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/does not match the claimed content hash/);
  });

  it("registers audio and video the same way as image", async () => {
    const { token, wallet } = await registerAndLinkWallet();

    for (const [contentType, mimetype, ext, mockFn] of [
      ["music", "audio/mpeg", "mp3", "analyzeAudio"],
      ["video", "video/mp4", "mp4", "analyzeVideo"],
    ]) {
      const buffer = Buffer.from(`fake-${contentType}-bytes-${"y".repeat(50)}`);
      const contentHash = sha256Buffer(buffer);

      blockchainService.confirmTransaction.mockResolvedValue({ confirmed: true });
      blockchainService.readAssetOnChain.mockResolvedValue({
        contentHash,
        owner: wallet.address,
        registeredBy: wallet.address,
        timestamp: Math.floor(Date.now() / 1000),
        contentType,
        aiModel: "Other",
        active: true,
      });
      blockchainService.readOwnershipHistoryOnChain.mockResolvedValue([wallet.address]);
      aiService[mockFn].mockResolvedValue({
        similarityScore: 0.1,
        matchedAssets: [],
        analysisMethod: "test",
        confidence: "low",
        warning: null,
      });

      const prep = await request(app)
        .post("/api/assets/prepare-file")
        .set("Authorization", `Bearer ${token}`)
        .field("contentType", contentType)
        .attach("file", buffer, { filename: `f.${ext}`, contentType: mimetype });

      const res = await request(app)
        .post("/api/assets/register-file")
        .set("Authorization", `Bearer ${token}`)
        .field("assetId", prep.body.assetId)
        .field("contentHash", prep.body.contentHash)
        .field("txHash", "0x" + "c".repeat(64))
        .field("title", `Test ${contentType}`)
        .field("contentType", contentType)
        .attach("file", buffer, { filename: `f.${ext}`, contentType: mimetype });

      expect(res.status).toBe(201);
      expect(aiService[mockFn]).toHaveBeenCalled();
    }
  });
});

describe("File-based verification", () => {
  it("finds an exact match for a previously registered image's exact bytes", async () => {
    const { token, wallet } = await registerAndLinkWallet();
    const buffer = fakeImageBuffer("verify-exact");
    const contentHash = sha256Buffer(buffer);

    blockchainService.confirmTransaction.mockResolvedValue({ confirmed: true });
    blockchainService.readAssetOnChain.mockResolvedValue({
      contentHash,
      owner: wallet.address,
      registeredBy: wallet.address,
      timestamp: Math.floor(Date.now() / 1000),
      contentType: "image",
      aiModel: "Other",
      active: true,
    });
    blockchainService.readOwnershipHistoryOnChain.mockResolvedValue([wallet.address]);
    aiService.analyzeImage.mockResolvedValue({
      similarityScore: 0,
      matchedAssets: [],
      analysisMethod: "Perceptual Hash",
      confidence: "low",
      warning: null,
    });

    const prep = await request(app)
      .post("/api/assets/prepare-file")
      .set("Authorization", `Bearer ${token}`)
      .field("contentType", "image")
      .attach("file", buffer, { filename: "a.jpg", contentType: "image/jpeg" });

    await request(app)
      .post("/api/assets/register-file")
      .set("Authorization", `Bearer ${token}`)
      .field("assetId", prep.body.assetId)
      .field("contentHash", prep.body.contentHash)
      .field("txHash", "0x" + "d".repeat(64))
      .field("title", "Verify Exact Match Test")
      .field("contentType", "image")
      .attach("file", buffer, { filename: "a.jpg", contentType: "image/jpeg" });

    const verifyRes = await request(app)
      .post("/api/assets/verify-file")
      .attach("file", buffer, { filename: "a-copy.jpg", contentType: "image/jpeg" });

    expect(verifyRes.body.exactMatch).toBe(true);
    expect(verifyRes.body.contentHash).toBe(contentHash);
  });

  it("reports no exact match for a never-registered file", async () => {
    const res = await request(app)
      .post("/api/assets/verify-file")
      .attach("file", Buffer.from("never registered bytes"), { filename: "x.jpg", contentType: "image/jpeg" });
    expect(res.body.exactMatch).toBe(false);
  });

  it("runs a non-persisted similarity check for an image via similarity-check-file", async () => {
    aiService.analyzeImage.mockResolvedValue({
      similarityScore: 0.93,
      matchedAssets: [{ assetId: "asset-existing", similarityScore: 0.93 }],
      analysisMethod: "Perceptual Hash",
      confidence: "moderate",
      warning: "Possible Derivative Work",
    });

    const res = await request(app)
      .post("/api/assets/similarity-check-file")
      .field("contentType", "image")
      .attach("file", fakeImageBuffer("sim-check"), { filename: "b.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(200);
    expect(res.body.analysis.warning).toBe("Possible Derivative Work");

    const callArgs = aiService.analyzeImage.mock.calls[0];
    // (assetId, buffer, filename, mimetype, persist) — confirm persist=false for the probe.
    expect(callArgs[0]).toMatch(/^probe-/);
    expect(callArgs[4]).toBe(false);
  });

  it("rejects similarity-check-file with a missing file or unsupported contentType", async () => {
    const missingFile = await request(app).post("/api/assets/similarity-check-file").field("contentType", "image");
    expect(missingFile.status).toBe(400);

    const badType = await request(app)
      .post("/api/assets/similarity-check-file")
      .field("contentType", "article")
      .attach("file", Buffer.from("x"), { filename: "a.jpg", contentType: "image/jpeg" });
    expect(badType.status).toBe(400);
  });
});

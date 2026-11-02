process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

const request = require("supertest");
const { ethers } = require("ethers");
const createApp = require("../app");
const { setupTestDB, teardownTestDB, clearTestDB } = require("./setup");

const app = createApp();

beforeAll(setupTestDB);
afterAll(teardownTestDB);
afterEach(clearTestDB);

async function registerAndLinkWallet() {
  const credentials = { email: `profile+${Date.now()}+${Math.random()}@example.com`, password: "supersecure123" };
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

describe("Creator profiles", () => {
  it("returns null displayName before any profile is set — never fabricates a name", async () => {
    const { token, wallet } = await registerAndLinkWallet();
    const res = await request(app).get("/api/profiles/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.profile.walletAddress).toBe(wallet.address.toLowerCase());
    expect(res.body.profile.displayName).toBeNull();
  });

  it("sets and retrieves a display name for the authenticated user's wallet", async () => {
    const { token, wallet } = await registerAndLinkWallet();

    const setRes = await request(app)
      .put("/api/profiles/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ displayName: "Jane Creator", bio: "AI artist" });
    expect(setRes.status).toBe(200);
    expect(setRes.body.profile.displayName).toBe("Jane Creator");

    const publicRes = await request(app).get(`/api/profiles/${wallet.address}`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.displayName).toBe("Jane Creator");
    expect(publicRes.body.walletAddress).toBe(wallet.address.toLowerCase());
  });

  it("rejects an empty display name", async () => {
    const { token } = await registerAndLinkWallet();
    const res = await request(app)
      .put("/api/profiles/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ displayName: "   " });
    expect(res.status).toBe(400);
  });

  it("requires auth to set a profile, but not to view one", async () => {
    const noAuth = await request(app).put("/api/profiles/me").send({ displayName: "X" });
    expect(noAuth.status).toBe(401);

    const randomWallet = ethers.Wallet.createRandom();
    const publicRead = await request(app).get(`/api/profiles/${randomWallet.address}`);
    expect(publicRead.status).toBe(200);
    expect(publicRead.body.displayName).toBeNull(); // no profile set — never invents one
  });

  it("never implies the display name is on-chain: the wallet address is always present alongside it", async () => {
    const { token, wallet } = await registerAndLinkWallet();
    await request(app)
      .put("/api/profiles/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ displayName: "On-chain Test" });

    const res = await request(app).get(`/api/profiles/${wallet.address}`);
    expect(res.body).toHaveProperty("walletAddress");
    expect(res.body).toHaveProperty("displayName");
  });
});

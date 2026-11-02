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

describe("Auth API", () => {
  const credentials = { email: "creator@example.com", password: "supersecure123" };

  it("registers a new user with a hashed password (never returns the raw password)", async () => {
    const res = await request(app).post("/api/auth/register").send(credentials);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(credentials.email);
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.password).toBeUndefined();
  });

  it("rejects registration with a short password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "short@example.com", password: "123" });
    expect(res.status).toBe(400);
  });

  it("rejects duplicate email registration", async () => {
    await request(app).post("/api/auth/register").send(credentials);
    const res = await request(app).post("/api/auth/register").send(credentials);
    expect(res.status).toBe(409);
  });

  it("logs in with correct credentials and rejects incorrect ones", async () => {
    await request(app).post("/api/auth/register").send(credentials);

    const good = await request(app).post("/api/auth/login").send(credentials);
    expect(good.status).toBe(200);
    expect(good.body.token).toBeDefined();

    const bad = await request(app)
      .post("/api/auth/login")
      .send({ email: credentials.email, password: "wrongpassword" });
    expect(bad.status).toBe(401);
  });

  it("rejects protected routes without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("links a MetaMask wallet via nonce + signature verification", async () => {
    const registerRes = await request(app).post("/api/auth/register").send(credentials);
    const token = registerRes.body.token;

    const nonceRes = await request(app)
      .get("/api/auth/wallet/nonce")
      .set("Authorization", `Bearer ${token}`);
    expect(nonceRes.status).toBe(200);
    expect(nonceRes.body.message).toContain("ProofChain wallet verification");

    // Simulate what MetaMask does client-side: sign the exact issued message.
    const wallet = ethers.Wallet.createRandom();
    const signature = await wallet.signMessage(nonceRes.body.message);

    const linkRes = await request(app)
      .post("/api/auth/wallet/link")
      .set("Authorization", `Bearer ${token}`)
      .send({ walletAddress: wallet.address, signature });

    expect(linkRes.status).toBe(200);
    expect(linkRes.body.user.walletAddress.toLowerCase()).toBe(wallet.address.toLowerCase());
  });

  it("rejects wallet linking when the signature doesn't match the claimed address", async () => {
    const registerRes = await request(app).post("/api/auth/register").send(credentials);
    const token = registerRes.body.token;

    await request(app).get("/api/auth/wallet/nonce").set("Authorization", `Bearer ${token}`);

    const signer = ethers.Wallet.createRandom();
    const impersonated = ethers.Wallet.createRandom();
    const signature = await signer.signMessage("some other message");

    const linkRes = await request(app)
      .post("/api/auth/wallet/link")
      .set("Authorization", `Bearer ${token}`)
      .send({ walletAddress: impersonated.address, signature });

    expect(linkRes.status).toBe(401);
  });
});

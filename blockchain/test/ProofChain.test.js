const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("ProofChain", function () {
  let proofChain;
  let owner, alice, bob, stranger;

  const CONTENT_TYPE = "article";
  const AI_MODEL = "ChatGPT";

  // Helper: mimic how the backend derives assetId + contentHash off-chain.
  function makeAsset(content, salt) {
    const contentHash = ethers.sha256(ethers.toUtf8Bytes(content));
    const assetId = ethers.keccak256(
      ethers.solidityPacked(["bytes32", "string"], [contentHash, salt])
    );
    return { contentHash, assetId };
  }

  beforeEach(async function () {
    [owner, alice, bob, stranger] = await ethers.getSigners();
    const ProofChain = await ethers.getContractFactory("ProofChain");
    proofChain = await ProofChain.deploy();
    await proofChain.waitForDeployment();
  });

  describe("registerAsset", function () {
    it("registers a new asset and emits AssetRegistered", async function () {
      const { contentHash, assetId } = makeAsset("Artificial intelligence is changing education.", "salt-1");

      await expect(
        proofChain.connect(alice).registerAsset(assetId, contentHash, CONTENT_TYPE, AI_MODEL)
      )
        .to.emit(proofChain, "AssetRegistered")
        .withArgs(assetId, alice.address, contentHash, CONTENT_TYPE, AI_MODEL, anyValue);

      const asset = await proofChain.getAsset(assetId);
      expect(asset.owner).to.equal(alice.address);
      expect(asset.registeredBy).to.equal(alice.address);
      expect(asset.contentHash).to.equal(contentHash);
      expect(asset.contentType).to.equal(CONTENT_TYPE);
      expect(asset.aiModel).to.equal(AI_MODEL);
      expect(asset.active).to.equal(true);
    });

    it("rejects duplicate assetId registration", async function () {
      const { contentHash, assetId } = makeAsset("duplicate test", "salt-2");
      await proofChain.connect(alice).registerAsset(assetId, contentHash, CONTENT_TYPE, AI_MODEL);

      await expect(
        proofChain.connect(bob).registerAsset(assetId, contentHash, CONTENT_TYPE, AI_MODEL)
      ).to.be.revertedWith("ProofChain: assetId already registered");
    });

    it("rejects an empty contentHash", async function () {
      const { assetId } = makeAsset("empty hash test", "salt-3");
      await expect(
        proofChain.connect(alice).registerAsset(assetId, ethers.ZeroHash, CONTENT_TYPE, AI_MODEL)
      ).to.be.revertedWith("ProofChain: contentHash required");
    });
  });

  describe("verifyAsset / getAsset", function () {
    it("reverts for an asset that was never registered", async function () {
      const fakeId = ethers.keccak256(ethers.toUtf8Bytes("never-registered"));
      await expect(proofChain.verifyAsset(fakeId)).to.be.revertedWith("ProofChain: asset not registered");
    });

    it("isRegistered returns false for unknown assets and true for known ones", async function () {
      const { contentHash, assetId } = makeAsset("registered check", "salt-4");
      expect(await proofChain.isRegistered(assetId)).to.equal(false);
      await proofChain.connect(alice).registerAsset(assetId, contentHash, CONTENT_TYPE, AI_MODEL);
      expect(await proofChain.isRegistered(assetId)).to.equal(true);
    });
  });

  describe("transferOwnership", function () {
    it("allows the current owner to transfer to a new wallet", async function () {
      const { contentHash, assetId } = makeAsset("transfer test", "salt-5");
      await proofChain.connect(alice).registerAsset(assetId, contentHash, CONTENT_TYPE, AI_MODEL);

      await expect(proofChain.connect(alice).transferOwnership(assetId, bob.address))
        .to.emit(proofChain, "OwnershipTransferred")
        .withArgs(assetId, alice.address, bob.address, anyValue);

      const asset = await proofChain.getAsset(assetId);
      expect(asset.owner).to.equal(bob.address);
      // registeredBy stays the original registrant even after transfer
      expect(asset.registeredBy).to.equal(alice.address);
    });

    it("rejects transfer attempts from a non-owner", async function () {
      const { contentHash, assetId } = makeAsset("unauthorized transfer test", "salt-6");
      await proofChain.connect(alice).registerAsset(assetId, contentHash, CONTENT_TYPE, AI_MODEL);

      await expect(
        proofChain.connect(stranger).transferOwnership(assetId, bob.address)
      ).to.be.revertedWith("ProofChain: caller is not the owner");
    });

    it("rejects transferring to the zero address", async function () {
      const { contentHash, assetId } = makeAsset("zero address test", "salt-7");
      await proofChain.connect(alice).registerAsset(assetId, contentHash, CONTENT_TYPE, AI_MODEL);

      await expect(
        proofChain.connect(alice).transferOwnership(assetId, ethers.ZeroAddress)
      ).to.be.revertedWith("ProofChain: cannot transfer to zero address");
    });

    it("rejects transferring to the current owner", async function () {
      const { contentHash, assetId } = makeAsset("self transfer test", "salt-8");
      await proofChain.connect(alice).registerAsset(assetId, contentHash, CONTENT_TYPE, AI_MODEL);

      await expect(
        proofChain.connect(alice).transferOwnership(assetId, alice.address)
      ).to.be.revertedWith("ProofChain: newOwner is already the owner");
    });
  });

  describe("getOwnershipHistory", function () {
    it("tracks the full chronological ownership trail across multiple transfers", async function () {
      const { contentHash, assetId } = makeAsset("history test", "salt-9");
      await proofChain.connect(alice).registerAsset(assetId, contentHash, CONTENT_TYPE, AI_MODEL);
      await proofChain.connect(alice).transferOwnership(assetId, bob.address);
      await proofChain.connect(bob).transferOwnership(assetId, stranger.address);

      const history = await proofChain.getOwnershipHistory(assetId);
      expect(history).to.deep.equal([alice.address, bob.address, stranger.address]);
    });
  });
});


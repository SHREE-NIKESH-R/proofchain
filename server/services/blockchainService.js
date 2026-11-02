const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const NETWORK = process.env.BLOCKCHAIN_NETWORK || "localhost";
const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";

let cachedContract = null;
let cachedProvider = null;

function loadDeployment() {
  const deploymentPath = path.join(
    __dirname,
    "..",
    "..",
    "blockchain",
    "deployments",
    `${NETWORK}.json`
  );

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(
      `[blockchainService] No deployment found for network "${NETWORK}" at ${deploymentPath}. ` +
        `Run "npx hardhat run scripts/deploy.js --network ${NETWORK}" inside blockchain/ first.`
    );
  }

  return JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
}

function getProvider() {
  if (!cachedProvider) {
    cachedProvider = new ethers.JsonRpcProvider(RPC_URL);
  }
  return cachedProvider;
}

/**
 * Returns a read-only Contract instance. The backend NEVER holds a private key
 * or signs transactions on a user's behalf — all writes (register/transfer)
 * are signed client-side via MetaMask. The backend only reads and verifies.
 */
function getContract() {
  if (!cachedContract) {
    const { address, abi } = loadDeployment();
    cachedContract = new ethers.Contract(address, abi, getProvider());
  }
  return cachedContract;
}

/**
 * Reads an asset directly from the chain and confirms it matches what the
 * client claims, before we trust it enough to store in MongoDB.
 */
async function readAssetOnChain(assetId) {
  const contract = getContract();
  const isRegistered = await contract.isRegistered(assetId);
  if (!isRegistered) return null;

  const asset = await contract.getAsset(assetId);
  return {
    assetId,
    contentHash: asset.contentHash,
    owner: asset.owner,
    registeredBy: asset.registeredBy,
    timestamp: Number(asset.timestamp),
    contentType: asset.contentType,
    aiModel: asset.aiModel,
    active: asset.active,
  };
}

async function readOwnershipHistoryOnChain(assetId) {
  const contract = getContract();
  return contract.getOwnershipHistory(assetId);
}

/**
 * Confirms a transaction was actually mined and succeeded, and (loosely) that
 * it targeted our contract. Used to sanity-check txHash values the client sends us.
 */
async function confirmTransaction(txHash) {
  const provider = getProvider();
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) return { confirmed: false, reason: "Transaction not found or not yet mined" };
  if (receipt.status !== 1) return { confirmed: false, reason: "Transaction reverted" };
  return { confirmed: true, receipt };
}

module.exports = {
  getProvider,
  getContract,
  readAssetOnChain,
  readOwnershipHistoryOnChain,
  confirmTransaction,
};

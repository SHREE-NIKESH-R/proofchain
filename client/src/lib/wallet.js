import { BrowserProvider, Contract } from "ethers";
import deployment from "../contracts/localhost.json";

export function isMetaMaskAvailable() {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

/**
 * Prompts MetaMask to connect and returns the connected address.
 * Also nudges the user to switch to the local Hardhat network (chainId 31337)
 * during Phase 1 development.
 */
export async function connectWallet() {
  if (!isMetaMaskAvailable()) {
    throw new Error("MetaMask is not installed. Install it from metamask.io to continue.");
  }
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  return accounts[0];
}

export async function getSigner() {
  if (!isMetaMaskAvailable()) {
    throw new Error("MetaMask is not installed.");
  }
  const provider = new BrowserProvider(window.ethereum);
  return provider.getSigner();
}

export async function getContractWithSigner() {
  if (!deployment.address || deployment.abi.length === 0) {
    throw new Error(
      "Contract not deployed/synced yet. Run the deploy script in blockchain/, then `npm run sync:contract` in client/."
    );
  }
  const signer = await getSigner();
  return new Contract(deployment.address, deployment.abi, signer);
}

/**
 * Signs and sends the on-chain registerAsset() transaction, waits for it to be mined,
 * and returns the transaction hash for the backend to independently verify.
 */
export async function registerAssetOnChain({ assetId, contentHash, contentType, aiModel }) {
  const contract = await getContractWithSigner();
  const tx = await contract.registerAsset(assetId, contentHash, contentType, aiModel || "Human-created / Unknown");
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function transferAssetOnChain({ assetId, newOwner }) {
  const contract = await getContractWithSigner();
  const tx = await contract.transferOwnership(assetId, newOwner);
  const receipt = await tx.wait();
  return receipt.hash;
}

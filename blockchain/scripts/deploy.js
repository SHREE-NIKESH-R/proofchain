const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const ProofChain = await hre.ethers.getContractFactory("ProofChain");
  const proofChain = await ProofChain.deploy();
  await proofChain.waitForDeployment();

  const address = await proofChain.getAddress();
  const network = hre.network.name;

  console.log(`ProofChain deployed to: ${address} (network: ${network})`);

  // Write deployment info where both server/ and client/ can read it during local dev.
  const artifact = await hre.artifacts.readArtifact("ProofChain");
  const deploymentInfo = {
    network,
    address,
    abi: artifact.abi,
    deployedAt: new Date().toISOString(),
  };

  const outDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, `${network}.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log(`Deployment info written to blockchain/deployments/${network}.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// Copies the latest Hardhat deployment (address + ABI) into the client so the
// frontend can talk to the contract without any manual copy/paste.
// Run this after every `npx hardhat run scripts/deploy.js --network <network>`.
const fs = require("fs");
const path = require("path");

const network = process.argv[2] || "localhost";
const src = path.join(
  __dirname,
  "..",
  "..",
  "blockchain",
  "deployments",
  `${network}.json`,
);
const destDir = path.join(__dirname, "..", "src", "contracts");
const dest = path.join(destDir, `${network}.json`);

if (!fs.existsSync(src)) {
  console.error(
    `No deployment file found at ${src}. Deploy the contract first.`,
  );
  process.exit(1);
}

if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(
  `Synced ${network} deployment into client/src/contracts/${network}.json`,
);

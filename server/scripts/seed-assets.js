const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const { EJSON } = require("bson");
const Asset = require("../models/Asset");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const fixturePath = path.resolve(__dirname, "..", "..", "proofchain.assets.json");

async function seedAssets() {
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Asset seed fixture not found: ${fixturePath}`);
  }

  const assets = EJSON.parse(fs.readFileSync(fixturePath, "utf8"));
  if (!Array.isArray(assets)) {
    throw new Error("Asset seed fixture must contain a JSON array");
  }

  const assetIds = assets.map((asset) => asset.assetId);
  if (assetIds.some((assetId) => !assetId) || new Set(assetIds).size !== assetIds.length) {
    throw new Error("Asset seed fixture contains missing or duplicate assetId values");
  }

  for (const asset of assets) {
    await new Asset(asset).validate();
  }

  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/proofchain";
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });

  const collection = mongoose.connection.db.collection("assets");
  const existingByAssetId = await collection
    .find({ assetId: { $in: assetIds } }, { projection: { _id: 1, assetId: 1 } })
    .toArray();
  const existingById = await collection
    .find({ _id: { $in: assets.map((asset) => asset._id) } }, { projection: { _id: 1, assetId: 1 } })
    .toArray();

  const assetIdMap = new Map(existingByAssetId.map((asset) => [asset.assetId, asset]));
  const idMap = new Map(existingById.map((asset) => [String(asset._id), asset]));

  for (const asset of assets) {
    const sameAssetId = assetIdMap.get(asset.assetId);
    if (sameAssetId && String(sameAssetId._id) !== String(asset._id)) {
      throw new Error(`Asset ID ${asset.assetId} already exists with a different MongoDB _id`);
    }

    const sameDocumentId = idMap.get(String(asset._id));
    if (sameDocumentId && sameDocumentId.assetId !== asset.assetId) {
      throw new Error(`MongoDB _id ${asset._id} already belongs to a different asset`);
    }
  }

  const missingAssets = assets.filter((asset) => !assetIdMap.has(asset.assetId));
  if (missingAssets.length > 0) {
    await collection.insertMany(missingAssets, { ordered: true });
  }

  const importedCount = await collection.countDocuments({ assetId: { $in: assetIds } });
  if (importedCount !== assets.length) {
    throw new Error(`Expected ${assets.length} seeded assets, found ${importedCount}`);
  }

  console.log(
    `Seeded ${missingAssets.length} new asset(s); ${importedCount} fixture asset(s) are present in "${mongoose.connection.name}".`
  );
}

seedAssets()
  .catch((error) => {
    console.error("[db:seed] Asset import failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

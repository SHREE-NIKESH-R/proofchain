import test from "node:test";
import assert from "node:assert/strict";
import { formatAssetId } from "./formatAssetId.js";

test("formatAssetId shortens long asset IDs for list views", () => {
  const assetId =
    "0xea9c1115e3bb888d471596bfdf49a439e8226f52e827dc9b21cc1e0637d39a4e";
  assert.equal(formatAssetId(assetId), "0xea9c11...d39a4e");
});

test("formatAssetId keeps short values readable", () => {
  assert.equal(formatAssetId("ABC123"), "ABC123");
});

export function formatAssetId(assetId) {
  if (!assetId || typeof assetId !== "string") return "—";

  const trimmed = assetId.trim();
  if (trimmed.length <= 12) return trimmed;

  return `${trimmed.slice(0, 8)}...${trimmed.slice(-6)}`;
}

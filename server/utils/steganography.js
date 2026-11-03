const ZERO_WIDTH_CHARS = ["\u200B", "\u200C", "\u200D", "\u2060"];
const ZERO_WIDTH_REGEX = /[\u200B-\u200D\u2060\uFEFF]/g;
const HIDDEN_PREFIX = "PROOFCHAIN:";

function stripZeroWidthCharacters(value) {
  if (typeof value !== "string") return "";
  return value.replace(ZERO_WIDTH_REGEX, "");
}

function encodePayload(payload) {
  const bits = Array.from(payload)
    .map((char) => char.charCodeAt(0).toString(2).padStart(8, "0"))
    .join("");

  return bits
    .split("")
    .map((bit) => ZERO_WIDTH_CHARS[bit === "0" ? 0 : 1])
    .join("");
}

function decodePayload(payload) {
  const bits = Array.from(payload)
    .map((char) => {
      if (char === "\u200B") return "0";
      if (char === "\u200C") return "1";
      if (char === "\u200D") return "0";
      if (char === "\u2060") return "1";
      return "";
    })
    .join("");

  if (!bits) return "";

  const bytes = bits.match(/.{1,8}/g) || [];
  const chars = bytes
    .filter((byte) => byte.length === 8)
    .map((byte) => String.fromCharCode(parseInt(byte, 2)));

  return chars.join("");
}

function embedTxHash(text, txHash) {
  const original = typeof text === "string" ? text : "";
  const hash = typeof txHash === "string" ? txHash : "";

  if (!hash.trim()) {
    return original;
  }

  const payload = `${HIDDEN_PREFIX}${hash}`;
  const hiddenPayload = encodePayload(payload);
  return `${original}\u2060${hiddenPayload}\u2060`;
}

function extractTxHash(text) {
  if (typeof text !== "string") return null;

  const marker = "\u2060";
  const startIndex = text.indexOf(marker);
  if (startIndex === -1) return null;

  const trailing = text.slice(startIndex + marker.length);
  if (!trailing) return null;

  const endIndex = trailing.lastIndexOf(marker);
  const payload = endIndex === -1 ? trailing : trailing.slice(0, endIndex);
  if (!payload) return null;

  const decoded = decodePayload(payload);
  if (!decoded.startsWith(HIDDEN_PREFIX)) return null;

  return decoded.slice(HIDDEN_PREFIX.length);
}

module.exports = {
  stripZeroWidthCharacters,
  embedTxHash,
  extractTxHash,
};

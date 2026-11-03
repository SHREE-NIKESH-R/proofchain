const {
  embedTxHash,
  extractTxHash,
  stripZeroWidthCharacters,
} = require("../utils/steganography");

describe("text steganography hidden proof", () => {
  it("embeds a tx hash and preserves the visible text", () => {
    const originalText =
      "This is my original creative work for ProofChain verification.";
    const txHash = "0x1234567890abcdef1234567890abcdef12345678";

    const embedded = embedTxHash(originalText, txHash);

    expect(stripZeroWidthCharacters(embedded)).toBe(originalText);
    expect(embedded).not.toBe(originalText);
  });

  it("extracts the hidden tx hash from the embedded text", () => {
    const originalText =
      "This is my original creative work for ProofChain verification.";
    const txHash = "0x1234567890abcdef1234567890abcdef12345678";

    const embedded = embedTxHash(originalText, txHash);
    const extracted = extractTxHash(embedded);

    expect(extracted).toBe(txHash);
  });
});

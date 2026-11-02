const fs = require("fs");
const path = require("path");
const storageService = require("../services/storageService");

afterAll(() => {
  // Clean up anything left in the test uploads dir.
  if (fs.existsSync(storageService.UPLOAD_DIR)) {
    fs.rmSync(storageService.UPLOAD_DIR, { recursive: true, force: true });
  }
});

describe("storageService (local-disk implementation)", () => {
  it("uploads a buffer and returns a fetchable URL path", async () => {
    const buffer = Buffer.from("fake image bytes for testing");
    const result = await storageService.upload(buffer, "photo.jpg", "image/jpeg");

    expect(result.url).toMatch(/^\/uploads\/.+\.jpg$/);
    expect(result.sizeBytes).toBe(buffer.length);

    const savedPath = path.join(storageService.UPLOAD_DIR, result.storedName);
    expect(fs.existsSync(savedPath)).toBe(true);
    expect(fs.readFileSync(savedPath)).toEqual(buffer);
  });

  it("generates collision-resistant filenames for identical original names", async () => {
    const buffer = Buffer.from("content A");
    const first = await storageService.upload(buffer, "same-name.png", "image/png");
    const second = await storageService.upload(buffer, "same-name.png", "image/png");
    expect(first.storedName).not.toBe(second.storedName);
  });

  it("removes an uploaded file", async () => {
    const buffer = Buffer.from("to be deleted");
    const result = await storageService.upload(buffer, "temp.mp3", "audio/mpeg");
    const savedPath = path.join(storageService.UPLOAD_DIR, result.storedName);
    expect(fs.existsSync(savedPath)).toBe(true);

    await storageService.remove(result.storedName);
    expect(fs.existsSync(savedPath)).toBe(false);
  });

  it("does not throw when removing a file that doesn't exist", async () => {
    await expect(storageService.remove("nonexistent-file.mp4")).resolves.not.toThrow();
  });

  describe("validate", () => {
    it("rejects a file exceeding the max size", () => {
      const result = storageService.validate(
        { size: 10 * 1024 * 1024, mimetype: "image/jpeg" },
        { maxBytes: 8 * 1024 * 1024, allowedMimeTypes: ["image/jpeg"] }
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/exceeds the maximum/);
    });

    it("rejects an unsupported mime type", () => {
      const result = storageService.validate(
        { size: 1000, mimetype: "application/pdf" },
        { maxBytes: 8 * 1024 * 1024, allowedMimeTypes: ["image/jpeg", "image/png"] }
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/Unsupported file type/);
    });

    it("accepts a valid file within limits", () => {
      const result = storageService.validate(
        { size: 1000, mimetype: "image/png" },
        { maxBytes: 8 * 1024 * 1024, allowedMimeTypes: ["image/jpeg", "image/png"] }
      );
      expect(result.valid).toBe(true);
    });
  });
});

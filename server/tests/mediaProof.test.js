const {
  embedMediaProof,
  extractMediaProof,
} = require("../utils/mediaProof");
const zlib = require("zlib");
const request = require("supertest");
jest.mock("../services/aiService", () => ({
  embedMediaWatermark: jest.fn(async (_type, buffer) => buffer),
  extractMediaWatermark: jest.fn(async () => ({ txHash: null })),
}));
const aiService = require("../services/aiService");
const createApp = require("../app");

const TX_HASH = `0x${"a".repeat(64)}`;
const app = createApp();

function parseBuffer(res, callback) {
  const chunks = [];
  res.on("data", (chunk) => chunks.push(chunk));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
}
function pngCrc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(pngCrc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

const pngHeader = Buffer.alloc(13);
pngHeader.writeUInt32BE(1, 0);
pngHeader.writeUInt32BE(1, 4);
pngHeader[8] = 8;
pngHeader[9] = 2;
const PNG_BUFFER = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk("IHDR", pngHeader),
  pngChunk("IDAT", zlib.deflateSync(Buffer.from([0, 255, 0, 0]))),
  pngChunk("IEND", Buffer.alloc(0)),
]);
const JPEG_BUFFER = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDi6KKK+ZP3E//Z",
  "base64",
);
const WEBP_BUFFER = Buffer.from(
  "UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoBAAEAAUAmJaACdLoB+AADsAD+8ut//NgVzXPv9//S4P0uD9Lg/9KQAAA=",
  "base64",
);
const MP3_BUFFER = Buffer.from(
  "SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU2LjQwLjEwMQAAAAAAAAAAAAAA//uQZAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAABAAADQgD///////////////////////////////////////////8AAAAATGF2YzU2LjYwAAAAAAAAAAAAAAAAJAAAAAAAAAAA",
  "base64",
);

describe("media hidden proof metadata", () => {
  it.each([
    ["JPEG", "art.jpg", "image/jpeg", JPEG_BUFFER],
    ["PNG", "art.png", "image/png", PNG_BUFFER],
    ["WebP", "art.webp", "image/webp", WEBP_BUFFER],
  ])("embeds and extracts a transaction hash in %s EXIF metadata", async (
    _format,
    originalname,
    mimetype,
    buffer,
  ) => {
    const file = { originalname, mimetype, buffer };
    const embedded = await embedMediaProof(file, "image", TX_HASH);
    expect(embedded.equals(buffer)).toBe(false);
    await expect(
      extractMediaProof({ ...file, buffer: embedded }, "image"),
    ).resolves.toBe(TX_HASH);
  });

  it("embeds and extracts a transaction hash in MP3 ID3 metadata", async () => {
    const file = {
      originalname: "track.mp3",
      mimetype: "audio/mpeg",
      buffer: MP3_BUFFER,
    };

    const embedded = await embedMediaProof(file, "music", TX_HASH);
    expect(embedded.equals(MP3_BUFFER)).toBe(false);
    await expect(
      extractMediaProof({ ...file, buffer: embedded }, "music"),
    ).resolves.toBe(TX_HASH);
  });

  it("rejects unsupported media formats", async () => {
    await expect(
      embedMediaProof(
        {
          originalname: "clip.mp4",
          mimetype: "video/mp4",
          buffer: Buffer.from("not a supported proof format"),
        },
        "video",
        TX_HASH,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("returns no proof when the selected media has no ProofChain tag", async () => {
    await expect(
      extractMediaProof(
        {
          originalname: "track.mp3",
          mimetype: "audio/mpeg",
          buffer: MP3_BUFFER,
        },
        "music",
      ),
    ).resolves.toBeNull();
  });

  it("serves an embedded image file that can be submitted to extraction", async () => {
    aiService.embedMediaWatermark.mockResolvedValue(PNG_BUFFER);
    const embedded = await request(app)
      .post("/api/assets/hidden-proof/embed-media")
      .field("contentType", "image")
      .field("txHash", TX_HASH)
      .attach("file", PNG_BUFFER, {
        filename: "test.png",
        contentType: "image/png",
      })
      .buffer(true)
      .parse(parseBuffer);

    expect(embedded.status).toBe(200);
    expect(embedded.headers["content-disposition"]).toContain(
      "test-proofchain.png",
    );

    const extracted = await request(app)
      .post("/api/assets/hidden-proof/extract-media")
      .field("contentType", "image")
      .attach("file", embedded.body, {
        filename: "test-proofchain.png",
        contentType: "image/png",
      });

    expect(extracted.status).toBe(200);
    expect(extracted.body).toEqual({ txHash: TX_HASH, hiddenProof: true });
  });

  it("falls back to the transform watermark when media metadata is missing", async () => {
    aiService.extractMediaWatermark.mockResolvedValue({ txHash: TX_HASH });
    const extracted = await request(app)
      .post("/api/assets/hidden-proof/extract-media")
      .field("contentType", "image")
      .attach("file", PNG_BUFFER, {
        filename: "metadata-free.png",
        contentType: "image/png",
      });

    expect(extracted.status).toBe(200);
    expect(extracted.body).toEqual({ txHash: TX_HASH, hiddenProof: true });
    expect(aiService.extractMediaWatermark).toHaveBeenCalledWith(
      "image",
      PNG_BUFFER,
      "metadata-free.png",
      "image/png",
    );
  });
});

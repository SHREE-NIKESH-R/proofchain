const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

async function post(path, body, isMultipart = false, headers = {}) {
  const res = await fetch(`${AI_SERVICE_URL}${path}`, {
    method: "POST",
    headers: isMultipart ? headers : { "Content-Type": "application/json", ...headers },
    body: isMultipart ? body : JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const error = new Error(errorBody.detail || `AI service returned ${res.status}`);
    error.status = res.status === 422 || res.status === 415 || res.status === 413 ? 422 : 502;
    throw error;
  }

  return res.json();
}

/**
 * Requests similarity analysis for text content (Prompt or Article).
 * Returns the consistent OriginalityResult shape from the AI service.
 */
async function analyzeText(assetId, text, contentType, persist = true) {
  return post("/analyze/text", { assetId, text, contentType, persist });
}

// Image/audio/video analysis follow the same multipart pattern once file uploads
// (StorageService) are wired in — intentionally not called yet from the asset
// controller since Phase 1 only registers text content. Exported now so Phase 2's
// image/audio/video registration work can use them without further plumbing.
async function analyzeImage(assetId, fileBuffer, filename, mimeType, persist = true) {
  const form = new FormData();
  form.append("assetId", assetId);
  form.append("persist", String(persist));
  form.append("file", new Blob([fileBuffer], { type: mimeType }), filename);
  return post("/analyze/image", form, true);
}

async function analyzeAudio(assetId, fileBuffer, filename, mimeType, persist = true) {
  const form = new FormData();
  form.append("assetId", assetId);
  form.append("persist", String(persist));
  form.append("file", new Blob([fileBuffer], { type: mimeType }), filename);
  return post("/analyze/audio", form, true);
}

async function analyzeVideo(assetId, fileBuffer, filename, mimeType, persist = true) {
  const form = new FormData();
  form.append("assetId", assetId);
  form.append("persist", String(persist));
  form.append("file", new Blob([fileBuffer], { type: mimeType }), filename);
  return post("/analyze/video", form, true);
}

module.exports = { analyzeText, analyzeImage, analyzeAudio, analyzeVideo };

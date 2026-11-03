# ProofChain AI Originality Engine (Phase 2)

Python/FastAPI service implementing the Multimodal Originality Engine described in the
product spec — text (prompt/article), image, audio, and video similarity analysis.
Called internally by the Node backend; never exposed directly to the frontend.

## Why a separate Python service
The Node backend (Express) handles auth, blockchain, and orchestration. This service
exists because the spec's required libraries — Sentence-Transformers, librosa, OpenCV —
are Python-native and have no equivalent-quality JS libraries, especially for audio
feature extraction. This was flagged as an explicit architecture tradeoff before Phase 1
and agreed on.

## Setup

```bash
cd ai-service
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# CPU-only PyTorch first, to avoid pulling multi-GB CUDA packages you don't need:
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt

cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

## Running tests

```bash
PYTHONPATH=. pytest tests/ -v
```

All 30 tests pass using real image processing (Pillow/imagehash), real audio processing
(librosa on synthesized tones), real similarity math, and `mongomock` in place of a live
MongoDB. The text pipeline's tests use an injected deterministic stub instead of the real
Sentence-Transformers model — this keeps the orchestration logic (storage, comparison,
exclusion of self-matches, prompt/article pool separation) genuinely verified without
requiring a multi-hundred-MB model download in CI or this environment. `app/text/analyze.py`
accepts `embedding_fn` specifically for this purpose; production code always uses the real
model via the default.

## What's real vs. what needs your machine to confirm

**Fully real and tested in this environment:**
- Perceptual hashing (`app/image/fingerprint.py`) — genuine pHash via `imagehash`, no external model
- Audio fingerprinting (`app/audio/fingerprint.py`) — genuine MFCC/chroma/tempo via `librosa`
- All similarity math (`app/similarity/compare.py`) — cosine similarity, Hamming distance
- Scoring/confidence/warning logic (`app/scoring/originality.py`)
- Full orchestration for all four pipelines (storage, comparison pools, self-exclusion, aggregation)
- The FastAPI app itself boots and serves `/health` and routes correctly

**Needs verification on your machine** (blocked in this build sandbox by network/disk policy, not a code issue):
- Real Sentence-Transformers text embeddings — the model download requires huggingface.co,
  which this sandbox's network allowlist blocks, and installing `torch` here hit a disk quota.
  The code path (`app/text/embedding.py`) is written and lazy-loads correctly (confirmed:
  the server boots fine and only fails at the exact call site when the model isn't installed).
- End-to-end HTTP calls against a real running MongoDB — this sandbox has no `mongod` binary
  available (same limitation hit in the Node backend's test suite). `pymongo` now fails fast
  (5s timeout) rather than hanging if Mongo is unreachable.
- Real video files through OpenCV's `VideoCapture` — the frame-extraction code is written per
  spec, but was tested via an injected frame-list stub (`extract_frames_fn`) rather than a real
  `.mp4`, since generating a valid test video file was out of scope for this pass. Recommend
  testing this specifically with a real short video once you have one on hand.

## Image embedding model — explicitly not chosen yet
`app/image/fingerprint.py`'s `get_image_embedding()` raises `NotImplementedError` on purpose.
Perceptual hashing alone is the real, working signal for Phase 2 (spec's "possible derivative
warning" example scenarios are hash-based near-duplicates). A specific lightweight embedding
model (e.g. MobileNetV3 or a CLIP ONNX export) should be chosen and benchmarked for CPU
inference time before wiring in — not guessed at now, per the "don't invent unverified deps"
instruction in the spec.

## Endpoints
- `POST /analyze/text` — `{assetId, text, contentType}` → `OriginalityResult`
- `POST /analyze/image` — multipart: `assetId`, `file` → `OriginalityResult`
- `POST /analyze/audio` — multipart: `assetId`, `file` → `OriginalityResult`
- `POST /analyze/video` — multipart: `assetId`, `file` → `OriginalityResult`
- `POST /watermark/embed` — multipart: `contentType`, `txHash`, `file` → watermarked image or MP3
- `POST /watermark/extract` — multipart: `contentType`, `file` → recovered transaction hash, if present
- `GET /health`

Every response follows the same shape (spec Section 27): `similarityScore`, `matchedAssets`,
`analysisMethod`, `confidence`, `warning`.

## Media proof watermark

The watermark service embeds a ProofChain transaction hash in the media signal using
Haar DWT plus block DCT for JPEG/PNG/WebP images, and Haar DWT plus frame DCT for MP3
audio. The payload is repeated and Reed-Solomon error-corrected. The Node backend also
writes an EXIF `UserComment` or MP3 ID3 comment as a second, convenient extraction path.
Extraction checks metadata first, then the transform-domain watermark, so metadata
removal alone does not remove the proof identifier.

Transform watermarking needs enough capacity for repeated payloads: images smaller
than roughly 512×512 pixels and very short MP3 clips may be rejected. Heavy cropping,
resizing, filtering, or lossy re-encoding can still damage a watermark. The recovered
hash is an identifier only; clients should independently verify the transaction on the
blockchain. Video watermark embedding is not implemented.

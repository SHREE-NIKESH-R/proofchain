"""
Image fingerprinting for originality analysis (spec Section 4.3 / 29).

Two independent, complementary signals are produced:
  1. Perceptual hash (pHash) — robust to resize/recompress/minor edits, cheap, no model needed.
  2. Image embedding — captures broader visual/semantic similarity a pHash alone can miss.

SHA-256 (exact-file identity, used for blockchain ownership proof) is computed by the
Node backend, not here — this module is originality/similarity only, per the product's
explicit separation of "ownership proof" vs "originality analysis" layers.
"""
from io import BytesIO
from functools import lru_cache
from PIL import Image
import imagehash

from app.config import settings

MAX_DIMENSION = 512  # resize before any processing — keeps this CPU-cheap per spec Section 29


def _load_and_resize(image_bytes: bytes) -> Image.Image:
    img = Image.open(BytesIO(image_bytes))
    img = img.convert("RGB")
    img.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
    return img


def compute_perceptual_hash(image_bytes: bytes) -> str:
    """Returns a 64-bit perceptual hash as a hex string, robust to resize/compression/minor edits."""
    img = _load_and_resize(image_bytes)
    return str(imagehash.phash(img))


@lru_cache(maxsize=1)
def _get_image_model():
    # Lazy import, same reasoning as the text embedding model: keep heavy deps off the
    # import path for callers (and tests) that only need the perceptual hash.
    # A small MobileNet/CLIP-style feature extractor is appropriate here — left as an
    # explicit integration point so a specific lightweight model can be pinned once
    # actually benchmarked on real hardware, per the "don't invent unverified deps" rule.
    raise NotImplementedError(
        "Image embedding model not yet wired up. Perceptual hashing (compute_perceptual_hash) "
        "is fully functional and is the primary signal for Phase 2. Swap this in once a "
        "specific lightweight model (e.g. a MobileNetV3 or CLIP ViT-B/32 ONNX export) is "
        "chosen and benchmarked for CPU inference time."
    )


def get_image_embedding(image_bytes: bytes) -> list[float]:
    model = _get_image_model()
    img = _load_and_resize(image_bytes)
    return model.encode(img)

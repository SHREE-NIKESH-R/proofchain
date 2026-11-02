"""
Text embedding generation.

Uses an embedding model (Sentence-Transformers), NOT an LLM chatbot, per the product
spec's explicit instruction in Section 4.1 — this computes a fixed vector representation
of the text, it does not "understand" or generate text about it.

The model is lazy-loaded on first use (not at import time) so that:
  - the FastAPI app can boot and serve /health without the model downloaded yet
  - tests can monkeypatch `get_text_embedding` without ever touching torch/HuggingFace
"""
from functools import lru_cache

from app.config import settings


@lru_cache(maxsize=1)
def _get_model():
    # Imported lazily: keeps `sentence-transformers`/torch off the import path for anything
    # that doesn't need it (e.g. running just the image/audio pipelines or the test suite
    # with a mocked embedding function).
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(settings.text_embedding_model)


def get_text_embedding(text: str) -> list[float]:
    """
    Returns a fixed-size embedding vector for the given text.
    Preprocessing (whitespace normalization) happens here; the model handles casing/tokenization.
    """
    normalized = " ".join(text.strip().split())
    model = _get_model()
    vector = model.encode(normalized, normalize_embeddings=True)
    return vector.tolist()

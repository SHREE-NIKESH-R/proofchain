import numpy as np


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """
    Returns cosine similarity in [0, 1] (clamped) between two vectors.
    Used for text and image embedding comparison.
    """
    a = np.array(vec_a, dtype=np.float64)
    b = np.array(vec_b, dtype=np.float64)

    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0

    similarity = float(np.dot(a, b) / (norm_a * norm_b))
    # Cosine similarity is technically in [-1, 1]; embeddings from modern models rarely
    # go negative for related content, but clamp defensively so scores are always [0, 1].
    return max(0.0, min(1.0, similarity))


def hamming_similarity(hash_a: str, hash_b: str) -> float:
    """
    Returns similarity in [0, 1] between two equal-length hex perceptual hashes,
    based on Hamming distance of their binary representation. Used for pHash comparison.
    """
    if len(hash_a) != len(hash_b):
        raise ValueError("Perceptual hashes must be the same length to compare")

    bits_a = bin(int(hash_a, 16))[2:].zfill(len(hash_a) * 4)
    bits_b = bin(int(hash_b, 16))[2:].zfill(len(hash_b) * 4)

    differing_bits = sum(c1 != c2 for c1, c2 in zip(bits_a, bits_b))
    total_bits = len(bits_a)
    return 1.0 - (differing_bits / total_bits)


def top_matches(scored_candidates: list[dict], top_k: int = 5, min_score: float = 0.0) -> list[dict]:
    """
    Given a list of {"assetId": ..., "score": ...} dicts, returns the top_k sorted
    descending by score, filtering out anything below min_score.
    """
    filtered = [c for c in scored_candidates if c["score"] >= min_score]
    return sorted(filtered, key=lambda c: c["score"], reverse=True)[:top_k]

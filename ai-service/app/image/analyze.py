from app.db import EmbeddingRepository
from app.similarity.compare import cosine_similarity, hamming_similarity, top_matches
from app.scoring.originality import build_originality_result
from app.models.schemas import OriginalityResult
from app.image.fingerprint import compute_perceptual_hash


def analyze_image(
    asset_id: str,
    image_bytes: bytes,
    repository: EmbeddingRepository,
    embedding_fn=None,
    persist: bool = True,
) -> OriginalityResult:
    """
    Image pipeline (spec Sections 4.3 / 29):
      image -> perceptual hash (always) -> compare against registered pHashes
      image -> [optional] embedding -> compare against registered embeddings
      -> combined similarity score

    `embedding_fn` is None by default because no specific lightweight image embedding
    model has been chosen/benchmarked yet (see app/image/fingerprint.py). Phase 2 ships
    with perceptual hashing as the real, working signal; the embedding path activates
    automatically once a model is wired in, with no changes needed here.
    """
    phash = compute_perceptual_hash(image_bytes)
    vector = embedding_fn(image_bytes) if embedding_fn else None

    existing = repository.find_all_by_type("image", exclude_asset_id=asset_id)

    scored = []
    for doc in existing:
        phash_score = hamming_similarity(phash, doc["extra"]["phash"]) if doc.get("extra", {}).get("phash") else 0.0
        if vector and doc.get("vector"):
            embedding_score = cosine_similarity(vector, doc["vector"])
            # Weighted blend: perceptual hash is the more reliable "near-duplicate" signal;
            # the embedding adds broader visual-similarity coverage. Weights are configurable
            # in principle — hardcoded here until Phase 3 wires scoring weights through config.
            combined = (0.6 * phash_score) + (0.4 * embedding_score)
        else:
            combined = phash_score
        scored.append({"assetId": doc["assetId"], "score": combined})

    matches = top_matches(scored, top_k=5)

    if persist:
        repository.save(asset_id, "image", vector or [], extra={"phash": phash})

    method = "Perceptual Hash + Image Embedding" if embedding_fn else "Perceptual Hash"
    return build_originality_result(matches, method, registered_count=len(existing))

from app.db import EmbeddingRepository
from app.similarity.compare import cosine_similarity, top_matches
from app.scoring.originality import build_originality_result
from app.models.schemas import OriginalityResult
from app.audio.fingerprint import extract_audio_fingerprint as default_extract_fingerprint


def analyze_audio(
    asset_id: str,
    audio_bytes: bytes,
    repository: EmbeddingRepository,
    fingerprint_fn=default_extract_fingerprint,
    persist: bool = True,
) -> OriginalityResult:
    """
    Music pipeline (spec Sections 4.4 / 31):
      audio -> preprocessing -> feature extraction (MFCC/chroma/tempo) -> normalized
      fingerprint -> compare against registered audio fingerprints -> cosine similarity.
    """
    fingerprint = fingerprint_fn(audio_bytes)

    existing = repository.find_all_by_type("music", exclude_asset_id=asset_id)
    scored = [
        {"assetId": doc["assetId"], "score": cosine_similarity(fingerprint, doc["vector"])}
        for doc in existing
    ]
    matches = top_matches(scored, top_k=5)

    if persist:
        repository.save(asset_id, "music", fingerprint)

    return build_originality_result(matches, "Audio Fingerprint (MFCC/Chroma/Tempo)", registered_count=len(existing))

from app.db import EmbeddingRepository
from app.similarity.compare import hamming_similarity, top_matches
from app.scoring.originality import build_originality_result
from app.models.schemas import OriginalityResult
from app.video.frames import extract_representative_frames as default_extract_frames
from app.image.fingerprint import compute_perceptual_hash


def analyze_video(
    asset_id: str,
    video_bytes: bytes,
    repository: EmbeddingRepository,
    extract_frames_fn=default_extract_frames,
    persist: bool = True,
) -> OriginalityResult:
    """
    Video pipeline (spec Sections 4.5 / 30):
      video -> extract representative frames -> each frame's perceptual hash ->
      compare against registered video frame-hashes -> aggregate per-candidate-asset
      similarity (mean of that asset's matched frames) -> overall video similarity score.

    This is an approximate similarity indicator, not an exact match — the spec is explicit
    that this must never be presented as more precise than it is (Section 4.5).
    """
    frames = extract_frames_fn(video_bytes)
    if not frames:
        return build_originality_result([], "Video Frame Sampling + Perceptual Hash", registered_count=0)

    frame_hashes = [compute_perceptual_hash(f) for f in frames]

    existing = repository.find_all_by_type("video", exclude_asset_id=asset_id)

    # For each registered video, compare our sampled frame hashes against its stored
    # frame hashes and aggregate to one score for that candidate asset.
    scored = []
    for doc in existing:
        candidate_hashes = doc.get("extra", {}).get("frameHashes", [])
        if not candidate_hashes:
            continue
        frame_scores = []
        for fh in frame_hashes:
            # Best match against any of the candidate's sampled frames — a video is
            # "similar" if any strong overlapping segment exists, not just on average.
            best = max((hamming_similarity(fh, ch) for ch in candidate_hashes), default=0.0)
            frame_scores.append(best)
        aggregate_score = sum(frame_scores) / len(frame_scores)
        scored.append({"assetId": doc["assetId"], "score": aggregate_score})

    matches = top_matches(scored, top_k=5)

    if persist:
        repository.save(asset_id, "video", [], extra={"frameHashes": frame_hashes, "frameCount": len(frame_hashes)})

    result = build_originality_result(matches, "Video Frame Sampling + Perceptual Hash", registered_count=len(existing))
    return result

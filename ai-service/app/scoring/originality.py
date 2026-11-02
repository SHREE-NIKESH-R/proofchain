from app.config import settings
from app.models.schemas import OriginalityResult, MatchedAsset


def build_originality_result(
    scored_matches: list[dict],
    analysis_method: str,
    registered_count: int,
) -> OriginalityResult:
    """
    Turns a list of {"assetId", "score"} matches into the consistent OriginalityResult shape,
    including a confidence label and a (non-legal) derivative-work warning.

    Confidence reflects how much registered content existed to compare against — a "91%
    similarity, no derivative warning" against a database of 2 assets is not the same
    confidence as against a database of 2000, and the UI should be able to say so honestly.
    """
    if not scored_matches:
        return OriginalityResult(
            similarityScore=0.0,
            matchedAssets=[],
            analysisMethod=analysis_method,
            confidence="low" if registered_count < 10 else "moderate",
            warning=None,
        )

    top = scored_matches[0]
    warning = None
    if top["score"] >= settings.derivative_warning_threshold:
        warning = "Possible Derivative Work"

    if registered_count < 10:
        confidence = "low"
    elif registered_count < 100:
        confidence = "moderate"
    else:
        confidence = "high"

    return OriginalityResult(
        similarityScore=round(top["score"], 4),
        matchedAssets=[MatchedAsset(assetId=m["assetId"], similarityScore=round(m["score"], 4)) for m in scored_matches],
        analysisMethod=analysis_method,
        confidence=confidence,
        warning=warning,
    )

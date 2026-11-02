from app.scoring.originality import build_originality_result


def test_no_matches_returns_zero_score_and_low_confidence_with_small_db():
    result = build_originality_result([], "Semantic Embedding", registered_count=3)
    assert result.similarityScore == 0.0
    assert result.matchedAssets == []
    assert result.warning is None
    assert result.confidence == "low"


def test_high_similarity_triggers_derivative_warning():
    matches = [{"assetId": "asset-1", "score": 0.91}]
    result = build_originality_result(matches, "Semantic Embedding", registered_count=50)
    assert result.warning == "Possible Derivative Work"
    assert result.similarityScore == 0.91


def test_low_similarity_does_not_trigger_warning():
    matches = [{"assetId": "asset-1", "score": 0.3}]
    result = build_originality_result(matches, "Semantic Embedding", registered_count=50)
    assert result.warning is None


def test_confidence_scales_with_registered_count():
    matches = [{"assetId": "asset-1", "score": 0.5}]
    assert build_originality_result(matches, "m", registered_count=5).confidence == "low"
    assert build_originality_result(matches, "m", registered_count=50).confidence == "moderate"
    assert build_originality_result(matches, "m", registered_count=500).confidence == "high"


def test_matched_assets_are_all_included_and_rounded():
    matches = [
        {"assetId": "a", "score": 0.123456},
        {"assetId": "b", "score": 0.654321},
    ]
    result = build_originality_result(matches, "m", registered_count=20)
    scores = {m.assetId: m.similarityScore for m in result.matchedAssets}
    assert scores["a"] == 0.1235
    assert scores["b"] == 0.6543

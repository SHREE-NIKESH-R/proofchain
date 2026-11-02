from app.text.analyze import analyze_text


def word_overlap_stub_embedding(text: str) -> list[float]:
    """
    Deterministic stand-in for a real sentence-embedding model, used ONLY in tests so the
    orchestration logic (storage, comparison, aggregation) can be verified without loading
    sentence-transformers/torch. It encodes word presence into a small fixed vocabulary,
    which is enough to produce meaningfully different vectors for different text.
    """
    vocab = ["ai", "education", "students", "learn", "cats", "recipe", "blockchain"]
    words = set(text.lower().split())
    return [1.0 if v in words else 0.0 for v in vocab]


def test_first_registration_has_no_matches(repository):
    result = analyze_text(
        "asset-1", "AI is transforming education", "article", repository, embedding_fn=word_overlap_stub_embedding
    )
    assert result.matchedAssets == []
    assert result.similarityScore == 0.0
    assert result.warning is None


def test_similar_text_is_flagged_against_previously_registered_asset(repository):
    analyze_text(
        "asset-1", "AI education students learn", "article", repository, embedding_fn=word_overlap_stub_embedding
    )
    result = analyze_text(
        "asset-2", "AI education students learn", "article", repository, embedding_fn=word_overlap_stub_embedding
    )
    assert result.similarityScore == 1.0
    assert result.warning == "Possible Derivative Work"
    assert result.matchedAssets[0].assetId == "asset-1"


def test_unrelated_text_is_not_flagged(repository):
    analyze_text("asset-1", "cats recipe", "article", repository, embedding_fn=word_overlap_stub_embedding)
    result = analyze_text(
        "asset-2", "blockchain ai education", "article", repository, embedding_fn=word_overlap_stub_embedding
    )
    assert result.warning is None


def test_prompt_and_article_pools_are_kept_separate(repository):
    # Same exact text, but registered under different content types — should NOT match
    # across pools, since prompts and articles are compared independently per the spec.
    analyze_text("asset-1", "AI education students learn", "prompt", repository, embedding_fn=word_overlap_stub_embedding)
    result = analyze_text(
        "asset-2", "AI education students learn", "article", repository, embedding_fn=word_overlap_stub_embedding
    )
    assert result.matchedAssets == []


def test_persist_false_does_not_store_the_embedding(repository):
    analyze_text(
        "probe-1", "AI education students learn", "article", repository,
        embedding_fn=word_overlap_stub_embedding, persist=False,
    )
    # A second, unrelated registration should find no trace of the probe.
    result = analyze_text(
        "asset-1", "AI education students learn", "article", repository, embedding_fn=word_overlap_stub_embedding
    )
    assert result.matchedAssets == []
    assert repository.get("probe-1") is None


def test_asset_excludes_itself_from_comparison_on_re_analysis(repository):
    analyze_text("asset-1", "AI education students learn", "article", repository, embedding_fn=word_overlap_stub_embedding)
    # Re-running analysis for the same assetId (e.g. re-processing) must not match itself.
    result = analyze_text(
        "asset-1", "AI education students learn", "article", repository, embedding_fn=word_overlap_stub_embedding
    )
    assert result.matchedAssets == []

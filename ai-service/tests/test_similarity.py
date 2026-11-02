import pytest
from app.similarity.compare import cosine_similarity, hamming_similarity, top_matches


def test_cosine_similarity_identical_vectors_is_one():
    v = [1.0, 2.0, 3.0]
    assert cosine_similarity(v, v) == pytest.approx(1.0)


def test_cosine_similarity_orthogonal_vectors_is_zero():
    assert cosine_similarity([1.0, 0.0], [0.0, 1.0]) == pytest.approx(0.0)


def test_cosine_similarity_handles_zero_vector():
    assert cosine_similarity([0.0, 0.0], [1.0, 1.0]) == 0.0


def test_cosine_similarity_is_clamped_to_zero_one():
    # Opposite vectors would mathematically give -1; the function should clamp to 0.
    assert cosine_similarity([1.0, 0.0], [-1.0, 0.0]) == 0.0


def test_hamming_similarity_identical_hashes_is_one():
    assert hamming_similarity("abcdef12", "abcdef12") == pytest.approx(1.0)


def test_hamming_similarity_completely_different_hashes():
    # 0x0 and 0xf differ in all 4 bits of that nibble.
    assert hamming_similarity("0000", "ffff") == pytest.approx(0.0)


def test_hamming_similarity_partial_difference():
    # "0" = 0000, "8" = 1000 -> 1 differing bit out of 4 total bits.
    assert hamming_similarity("0", "8") == pytest.approx(0.75)


def test_hamming_similarity_rejects_mismatched_lengths():
    with pytest.raises(ValueError):
        hamming_similarity("abcd", "abcdef")


def test_top_matches_sorts_and_limits():
    candidates = [
        {"assetId": "a", "score": 0.5},
        {"assetId": "b", "score": 0.9},
        {"assetId": "c", "score": 0.1},
        {"assetId": "d", "score": 0.7},
    ]
    result = top_matches(candidates, top_k=2)
    assert [c["assetId"] for c in result] == ["b", "d"]


def test_top_matches_filters_below_min_score():
    candidates = [{"assetId": "a", "score": 0.2}, {"assetId": "b", "score": 0.9}]
    result = top_matches(candidates, top_k=5, min_score=0.5)
    assert [c["assetId"] for c in result] == ["b"]

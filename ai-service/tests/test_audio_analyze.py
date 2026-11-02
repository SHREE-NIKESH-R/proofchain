import io
import numpy as np
import soundfile as sf
from app.audio.fingerprint import extract_audio_fingerprint
from app.audio.analyze import analyze_audio


def make_tone_bytes(freq=440.0, duration=2.0, sr=22050):
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    tone = 0.5 * np.sin(2 * np.pi * freq * t)
    buf = io.BytesIO()
    sf.write(buf, tone, sr, format="WAV")
    return buf.getvalue()


def test_identical_audio_has_similarity_one(repository):
    tone = make_tone_bytes(freq=440.0)
    analyze_audio("asset-1", tone, repository)
    result = analyze_audio("asset-2", tone, repository)
    assert result.similarityScore > 0.99


def test_different_pitched_tones_are_less_similar_than_identical(repository):
    low_tone = make_tone_bytes(freq=220.0)
    high_tone = make_tone_bytes(freq=880.0)

    analyze_audio("asset-1", low_tone, repository)
    same_pitch_result = analyze_audio("asset-2", low_tone, repository)

    different_pitch_result = analyze_audio("asset-3", high_tone, repository)

    assert same_pitch_result.similarityScore > different_pitch_result.similarityScore


def test_fingerprint_is_a_fixed_length_normalized_vector():
    fingerprint = extract_audio_fingerprint(make_tone_bytes())
    assert len(fingerprint) == 20 + 12 + 1  # MFCC + chroma + tempo
    norm = sum(x * x for x in fingerprint) ** 0.5
    assert abs(norm - 1.0) < 1e-6


def test_analyze_audio_persist_false_does_not_store(repository):
    tone = make_tone_bytes(freq=440.0)
    analyze_audio("probe-1", tone, repository, persist=False)
    assert repository.get("probe-1") is None
    result = analyze_audio("asset-1", tone, repository)
    assert result.matchedAssets == []

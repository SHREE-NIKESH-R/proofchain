"""
Audio fingerprinting (spec Section 4.4 / 31).

Uses lightweight, CPU-only feature extraction via librosa — no external model download,
no paid API. Features: MFCC, chroma, and tempo, aggregated into a single normalized
fingerprint vector that similarity/compare.py's cosine_similarity can compare directly.
"""
import io
import numpy as np
import librosa

SAMPLE_RATE = 22050  # librosa's standard default; downsampling keeps this CPU-cheap
N_MFCC = 20


def extract_audio_fingerprint(audio_bytes: bytes) -> list[float]:
    """
    Loads audio from raw bytes and returns a fixed-length normalized fingerprint vector
    built from MFCC (timbre), chroma (pitch class content), and tempo.
    """
    y, sr = librosa.load(io.BytesIO(audio_bytes), sr=SAMPLE_RATE, mono=True)

    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=N_MFCC)
    mfcc_mean = np.mean(mfcc, axis=1)

    chroma = librosa.feature.chroma_stft(y=y, sr=sr)
    chroma_mean = np.mean(chroma, axis=1)

    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    tempo_value = float(np.atleast_1d(tempo)[0])

    fingerprint = np.concatenate([mfcc_mean, chroma_mean, [tempo_value]])

    # Normalize so tempo (which is on a very different numeric scale, ~60-200) doesn't
    # dominate cosine similarity against MFCC/chroma coefficients.
    norm = np.linalg.norm(fingerprint)
    if norm > 0:
        fingerprint = fingerprint / norm

    return fingerprint.tolist()

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    mongodb_uri: str = "mongodb://127.0.0.1:27017/proofchain"

    # Model choice matters for free/CPU deployment (Phase 7 concern) but is set now
    # so the code path is real from day one, per the roadmap.
    text_embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"

    # Configurable thresholds — kept out of code so they can be tuned without redeploying logic.
    derivative_warning_threshold: float = 0.85  # similarity >= this => "Possible Derivative Work"

    # Video frame sampling: 1 frame extracted per N seconds. Configurable per Section 30 of the spec.
    video_frame_sample_interval_seconds: float = 2.0
    video_max_frames: int = 8

    # Upload guardrails
    max_text_length: int = 50_000
    max_image_bytes: int = 8 * 1024 * 1024
    max_audio_bytes: int = 20 * 1024 * 1024
    max_video_bytes: int = 60 * 1024 * 1024


settings = Settings()

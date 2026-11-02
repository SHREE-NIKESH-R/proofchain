from pydantic import BaseModel
from typing import Optional


class MatchedAsset(BaseModel):
    assetId: str
    similarityScore: float  # 0.0-1.0


class OriginalityResult(BaseModel):
    """
    The consistent shape every content-type pipeline (text/image/audio/video) returns,
    per the product spec's Section 27 requirement. Keeping this identical across pipelines
    is what makes the engine modular/extensible rather than one-off per content type.
    """
    similarityScore: float  # highest similarity found, 0.0-1.0
    matchedAssets: list[MatchedAsset]
    analysisMethod: str  # e.g. "Semantic Embedding", "Perceptual Hash + Image Embedding"
    confidence: str  # "high" | "moderate" | "low" — reflects how much registered data existed to compare against
    warning: Optional[str] = None  # e.g. "Possible Derivative Work" — never a legal claim, see spec Section 2


class TextAnalysisRequest(BaseModel):
    assetId: str
    text: str
    contentType: str  # "prompt" | "article" — kept as separate comparison pools
    persist: bool = True  # False for ad-hoc similarity checks that shouldn't be stored


class ImageAnalysisRequest(BaseModel):
    assetId: str
    # base64-encoded image bytes; kept simple for Phase 2 rather than multipart, matched by the route


class AudioAnalysisRequest(BaseModel):
    assetId: str


class VideoAnalysisRequest(BaseModel):
    assetId: str

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form

from app.db import EmbeddingRepository, get_embedding_repository
from app.models.schemas import (
    OriginalityResult,
    TextAnalysisRequest,
)
from app.config import settings

from app.text.analyze import analyze_text as run_text_analysis
from app.image.analyze import analyze_image as run_image_analysis
from app.audio.analyze import analyze_audio as run_audio_analysis
from app.video.analyze import analyze_video as run_video_analysis

router = APIRouter(prefix="/analyze", tags=["originality"])


@router.post("/text", response_model=OriginalityResult)
def analyze_text_route(
    payload: TextAnalysisRequest,
    repository: EmbeddingRepository = Depends(get_embedding_repository),
):
    if len(payload.text) > settings.max_text_length:
        raise HTTPException(status_code=413, detail="Text content exceeds the maximum allowed length")

    if payload.contentType not in ("prompt", "article"):
        raise HTTPException(status_code=400, detail='contentType must be "prompt" or "article"')

    # Prompt and article embeddings are compared within their own pool — a prompt
    # shouldn't be flagged as derivative of an unrelated article just because both
    # happen to be text, per the spec's per-content-type analysis requirement.
    return run_text_analysis(
        payload.assetId,
        payload.text,
        content_type=payload.contentType,
        repository=repository,
        persist=payload.persist,
    )


@router.post("/image", response_model=OriginalityResult)
async def analyze_image_route(
    assetId: str = Form(...),
    file: UploadFile = File(...),
    persist: bool = Form(True),
    repository: EmbeddingRepository = Depends(get_embedding_repository),
):
    image_bytes = await file.read()
    if len(image_bytes) > settings.max_image_bytes:
        raise HTTPException(status_code=413, detail="Image exceeds the maximum allowed size")
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=415, detail=f"Unsupported image type: {file.content_type}")

    return run_image_analysis(assetId, image_bytes, repository=repository, persist=persist)


@router.post("/audio", response_model=OriginalityResult)
async def analyze_audio_route(
    assetId: str = Form(...),
    file: UploadFile = File(...),
    persist: bool = Form(True),
    repository: EmbeddingRepository = Depends(get_embedding_repository),
):
    audio_bytes = await file.read()
    if len(audio_bytes) > settings.max_audio_bytes:
        raise HTTPException(status_code=413, detail="Audio exceeds the maximum allowed size")

    return run_audio_analysis(assetId, audio_bytes, repository=repository, persist=persist)


@router.post("/video", response_model=OriginalityResult)
async def analyze_video_route(
    assetId: str = Form(...),
    file: UploadFile = File(...),
    persist: bool = Form(True),
    repository: EmbeddingRepository = Depends(get_embedding_repository),
):
    video_bytes = await file.read()
    if len(video_bytes) > settings.max_video_bytes:
        raise HTTPException(status_code=413, detail="Video exceeds the maximum allowed size")

    return run_video_analysis(assetId, video_bytes, repository=repository, persist=persist)

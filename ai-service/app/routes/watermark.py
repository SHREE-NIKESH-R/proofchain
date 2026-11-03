from io import BytesIO

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from starlette.concurrency import run_in_threadpool
import soundfile as sf
from PIL import Image, UnidentifiedImageError

from app.config import settings
from app.watermark import embed_audio, embed_image, extract_audio, extract_image

router = APIRouter(prefix="/watermark", tags=["watermark"])
SUPPORTED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
SUPPORTED_AUDIO_TYPES = {"audio/mpeg", "audio/mp3"}
MAX_IMAGE_PIXELS = 25_000_000


def _validate_type(content_type: str, media_type: str) -> None:
    if content_type == "image" and media_type not in SUPPORTED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="Choose a JPEG, PNG, or WebP image")
    if content_type == "music" and media_type not in SUPPORTED_AUDIO_TYPES:
        raise HTTPException(status_code=415, detail="Choose an MP3 audio file")
    if content_type not in ("image", "music"):
        raise HTTPException(status_code=400, detail='contentType must be "image" or "music"')


def _validate_size(content_type: str, media: bytes) -> None:
    maximum = settings.max_image_bytes if content_type == "image" else settings.max_audio_bytes
    if len(media) > maximum:
        raise HTTPException(status_code=413, detail="Media exceeds the maximum allowed size")


def _run(operation, content_type: str, media: bytes, tx_hash: str | None = None):
    try:
        if content_type == "image":
            with Image.open(BytesIO(media)) as image:
                if image.width * image.height > MAX_IMAGE_PIXELS:
                    raise HTTPException(status_code=413, detail="Image dimensions are too large")
            return operation(media, tx_hash) if tx_hash is not None else operation(media)
        return operation(media, tx_hash) if tx_hash is not None else operation(media)
    except HTTPException:
        raise
    except (ValueError, OSError, UnidentifiedImageError, sf.LibsndfileError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post("/embed")
async def embed_watermark(
    contentType: str = Form(...),
    txHash: str = Form(...),
    file: UploadFile = File(...),
):
    _validate_type(contentType, file.content_type or "")
    media = await file.read()
    _validate_size(contentType, media)
    marked = await run_in_threadpool(
        _run,
        embed_image if contentType == "image" else embed_audio,
        contentType,
        media,
        txHash,
    )
    media_type = file.content_type if contentType == "image" else "audio/mpeg"
    return Response(content=marked, media_type=media_type)


@router.post("/extract")
async def extract_watermark(
    contentType: str = Form(...),
    file: UploadFile = File(...),
):
    _validate_type(contentType, file.content_type or "")
    media = await file.read()
    _validate_size(contentType, media)
    tx_hash = await run_in_threadpool(
        _run,
        extract_image if contentType == "image" else extract_audio,
        contentType,
        media,
    )
    return {"txHash": tx_hash, "watermarkFound": tx_hash is not None}

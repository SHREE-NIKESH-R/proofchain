import io

import numpy as np
import soundfile as sf
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from app.watermark import embed_audio, embed_image, extract_audio, extract_image
from app.main import app

TX_HASH = f"0x{'a' * 64}"
client = TestClient(app)


def make_image_bytes(image_format="JPEG"):
    image = Image.new("RGB", (512, 512), "white")
    ImageDraw.Draw(image).rectangle((90, 90, 420, 420), fill=(200, 40, 80))
    output = io.BytesIO()
    image.save(output, format=image_format, quality=92)
    return output.getvalue()


def make_mp3_bytes(duration_seconds=12):
    sample_rate = 44100
    time = np.arange(sample_rate * duration_seconds) / sample_rate
    samples = (
        0.2 * np.sin(2 * np.pi * 440 * time)
        + 0.12 * np.sin(2 * np.pi * 1000 * time)
        + 0.08 * np.sin(2 * np.pi * 3000 * time)
    ).astype(np.float32)
    output = io.BytesIO()
    sf.write(
        output,
        samples,
        sample_rate,
        format="MP3",
        subtype="MPEG_LAYER_III",
    )
    return output.getvalue()


def test_image_dwt_dct_watermark_survives_exif_removal_and_jpeg_resave():
    marked = embed_image(make_image_bytes(), TX_HASH)
    assert extract_image(marked) == TX_HASH

    decoded = Image.open(io.BytesIO(marked))
    metadata_free = io.BytesIO()
    decoded.save(metadata_free, format="JPEG", quality=85)
    assert extract_image(metadata_free.getvalue()) == TX_HASH


def test_audio_dwt_dct_watermark_round_trips_after_mp3_encoding():
    marked = embed_audio(make_mp3_bytes(), TX_HASH)
    assert extract_audio(marked) == TX_HASH


def test_image_watermark_supports_png_and_webp():
    for image_format in ("PNG", "WEBP"):
        marked = embed_image(make_image_bytes(image_format), TX_HASH)
        assert extract_image(marked) == TX_HASH


def test_rejects_audio_that_is_too_short_for_a_robust_watermark():
    with np.testing.assert_raises_regex(ValueError, "too small or short"):
        embed_audio(make_mp3_bytes(duration_seconds=1), TX_HASH)


def test_rejects_invalid_transaction_hash():
    with np.testing.assert_raises_regex(ValueError, "32-byte hexadecimal"):
        embed_image(make_image_bytes(), "not-a-transaction-hash")


def test_watermark_http_routes_embed_and_extract_image_proof():
    embedded = client.post(
        "/watermark/embed",
        data={"contentType": "image", "txHash": TX_HASH},
        files={"file": ("work.jpg", make_image_bytes(), "image/jpeg")},
    )
    assert embedded.status_code == 200
    assert embedded.headers["content-type"].startswith("image/jpeg")

    extracted = client.post(
        "/watermark/extract",
        data={"contentType": "image"},
        files={"file": ("work.jpg", embedded.content, "image/jpeg")},
    )
    assert extracted.status_code == 200
    assert extracted.json() == {"txHash": TX_HASH, "watermarkFound": True}

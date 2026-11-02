from io import BytesIO
from PIL import Image, ImageDraw
from app.video.analyze import analyze_video


def make_frame(color, shape="rect"):
    # Perceptual hashing operates on grayscale luminance/structure, not color — a solid
    # red square and a solid blue square in the same position can hash as near-identical
    # (a real, documented pHash limitation, not a bug). Tests that need visually distinct
    # frames vary shape/position too, matching how test_image_analyze.py does it.
    img = Image.new("RGB", (200, 200), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    if shape == "rect":
        draw.rectangle([40, 40, 160, 160], fill=color)
    else:
        draw.ellipse([20, 100, 100, 180], fill=color)
    buf = BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_video_with_no_frames_returns_zero_score(repository):
    result = analyze_video("asset-1", b"irrelevant-bytes", repository, extract_frames_fn=lambda _: [])
    assert result.similarityScore == 0.0
    assert result.matchedAssets == []


def test_video_sharing_frames_with_a_registered_video_is_flagged(repository):
    red = make_frame((255, 0, 0))
    green = make_frame((0, 255, 0))
    blue = make_frame((0, 0, 255))

    # Register a "video" with 5 frames, matching the spec's Section 4.5 example shape.
    analyze_video("asset-1", b"video-1", repository, extract_frames_fn=lambda _: [red, green, blue, red, green])

    # A near-identical video (same frames) should score very high and get flagged.
    result = analyze_video("asset-2", b"video-2", repository, extract_frames_fn=lambda _: [red, green, blue, red, green])

    assert result.similarityScore > 0.9
    assert result.warning == "Possible Derivative Work"
    assert result.matchedAssets[0].assetId == "asset-1"


def test_video_with_completely_different_frames_is_not_flagged(repository):
    red_rect = make_frame((255, 0, 0), shape="rect")
    blue_ellipse = make_frame((0, 0, 255), shape="ellipse")

    analyze_video("asset-1", b"video-1", repository, extract_frames_fn=lambda _: [red_rect, red_rect, red_rect])
    result = analyze_video(
        "asset-2", b"video-2", repository, extract_frames_fn=lambda _: [blue_ellipse, blue_ellipse, blue_ellipse]
    )

    assert result.warning is None


def test_video_persist_false_does_not_store(repository):
    red = make_frame((255, 0, 0), shape="rect")
    frames = [red, red, red]
    analyze_video("probe-1", b"video-x", repository, extract_frames_fn=lambda _: frames, persist=False)
    assert repository.get("probe-1") is None
    result = analyze_video("asset-1", b"video-y", repository, extract_frames_fn=lambda _: frames)
    assert result.matchedAssets == []

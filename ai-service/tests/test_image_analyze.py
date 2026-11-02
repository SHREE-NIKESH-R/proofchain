from io import BytesIO
from PIL import Image, ImageDraw
from app.image.fingerprint import compute_perceptual_hash
from app.image.analyze import analyze_image


def make_image_bytes(color=(255, 0, 0), shape="rect", size=(200, 200)):
    img = Image.new("RGB", size, color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    if shape == "rect":
        draw.rectangle([40, 40, 160, 160], fill=color)
    else:
        draw.ellipse([40, 40, 160, 160], fill=color)
    buf = BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_identical_images_produce_identical_phash():
    img_bytes = make_image_bytes()
    assert compute_perceptual_hash(img_bytes) == compute_perceptual_hash(img_bytes)


def test_visually_different_images_produce_different_phash():
    red_rect = make_image_bytes(color=(255, 0, 0), shape="rect")
    blue_ellipse = make_image_bytes(color=(0, 0, 255), shape="ellipse")
    assert compute_perceptual_hash(red_rect) != compute_perceptual_hash(blue_ellipse)


def test_analyze_image_finds_near_duplicate_via_phash(repository):
    original = make_image_bytes(color=(200, 30, 30), shape="rect")
    # Simulate a lightly modified re-save (recompression) of the same visual content —
    # this is exactly the case perceptual hashing is meant to catch (spec Section 4.3).
    resaved = Image.open(BytesIO(original))
    buf = BytesIO()
    resaved.save(buf, format="JPEG", quality=60)
    modified = buf.getvalue()

    analyze_image("asset-1", original, repository)
    result = analyze_image("asset-2", modified, repository)

    assert result.similarityScore > 0.9
    assert result.matchedAssets[0].assetId == "asset-1"


def test_analyze_image_no_match_for_visually_distinct_image(repository):
    analyze_image("asset-1", make_image_bytes(color=(255, 0, 0), shape="rect"), repository)
    result = analyze_image("asset-2", make_image_bytes(color=(0, 0, 255), shape="ellipse"), repository)
    assert result.similarityScore < 0.9


def test_analyze_image_persist_false_does_not_store(repository):
    original = make_image_bytes(color=(200, 30, 30), shape="rect")
    analyze_image("probe-1", original, repository, persist=False)
    assert repository.get("probe-1") is None
    # A second, unrelated registration should find no trace of the probe.
    result = analyze_image("asset-1", original, repository)
    assert result.matchedAssets == []

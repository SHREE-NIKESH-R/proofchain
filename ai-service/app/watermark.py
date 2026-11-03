"""Transform-domain media watermarking for ProofChain transaction identifiers."""

import io
import re
import zlib

import numpy as np
import soundfile as sf
from PIL import Image
from reedsolo import ReedSolomonError, RSCodec
from scipy.fft import dctn, idctn

PAYLOAD_MAGIC = b"PCWM"
PAYLOAD_VERSION = b"\x01"
ERROR_CORRECTION_BYTES = 16
PAYLOAD_CODEC = RSCodec(ERROR_CORRECTION_BYTES)
PAYLOAD_BYTES = len(PAYLOAD_MAGIC) + len(PAYLOAD_VERSION) + 32 + 4 + ERROR_CORRECTION_BYTES
PAYLOAD_BITS = PAYLOAD_BYTES * 8
MIN_REPETITIONS = 2
MAX_REPETITIONS = 4
IMAGE_DELTA = 30.0
AUDIO_DELTA = 0.12
AUDIO_FRAME_SIZE = 256


def _encode_payload(tx_hash: str) -> np.ndarray:
    if not re.fullmatch(r"0x[0-9a-fA-F]{64}", tx_hash):
        raise ValueError("txHash must be a 32-byte hexadecimal transaction hash")
    raw_hash = bytes.fromhex(tx_hash[2:])
    payload = PAYLOAD_MAGIC + PAYLOAD_VERSION + raw_hash
    payload += zlib.crc32(payload).to_bytes(4, "big")
    encoded = PAYLOAD_CODEC.encode(payload)
    return np.unpackbits(np.frombuffer(encoded, dtype=np.uint8))


def _decode_payload(bits: np.ndarray) -> str | None:
    packed = np.packbits(bits.astype(np.uint8)).tobytes()
    if len(packed) < PAYLOAD_BYTES:
        return None

    try:
        content, _, _ = PAYLOAD_CODEC.decode(packed[:PAYLOAD_BYTES])
    except ReedSolomonError:
        return None
    content, checksum = content[:-4], content[-4:]
    if not content.startswith(PAYLOAD_MAGIC + PAYLOAD_VERSION):
        return None
    if zlib.crc32(content).to_bytes(4, "big") != checksum:
        return None
    return "0x" + content[len(PAYLOAD_MAGIC) + len(PAYLOAD_VERSION) :].hex()


def _qim_embed(first: float, second: float, bit: int, delta: float) -> tuple[float, float]:
    difference = first - second
    period = delta * 2
    residue = difference % period
    target_residue = delta if bit else 0.0
    correction = (target_residue - residue + delta) % period - delta
    return first + correction / 2, second - correction / 2


def _qim_read(first: float, second: float, delta: float) -> int:
    residue = (first - second) % (delta * 2)
    distance_zero = min(residue, delta * 2 - residue)
    distance_one = abs(residue - delta)
    return int(distance_one < distance_zero)


def _repetitions(block_count: int) -> int:
    repetitions = min(MAX_REPETITIONS, block_count // PAYLOAD_BITS)
    if repetitions < MIN_REPETITIONS:
        raise ValueError(
            "Media is too small or short for a robust ProofChain watermark"
        )
    return repetitions


def _haar_dwt2(matrix: np.ndarray) -> tuple[np.ndarray, tuple[np.ndarray, ...], tuple[int, int]]:
    height, width = matrix.shape
    padded = np.pad(
        matrix,
        ((0, height % 2), (0, width % 2)),
        mode="edge",
    )
    a = padded[0::2, 0::2]
    b = padded[0::2, 1::2]
    c = padded[1::2, 0::2]
    d = padded[1::2, 1::2]
    ll = (a + b + c + d) / 2
    details = (
        (a - b + c - d) / 2,
        (a + b - c - d) / 2,
        (a - b - c + d) / 2,
    )
    return ll, details, (height, width)


def _haar_idwt2(
    ll: np.ndarray,
    details: tuple[np.ndarray, ...],
    original_shape: tuple[int, int],
) -> np.ndarray:
    lh, hl, hh = details
    output = np.empty((ll.shape[0] * 2, ll.shape[1] * 2), dtype=np.float64)
    output[0::2, 0::2] = (ll + lh + hl + hh) / 2
    output[0::2, 1::2] = (ll - lh + hl - hh) / 2
    output[1::2, 0::2] = (ll + lh - hl - hh) / 2
    output[1::2, 1::2] = (ll - lh - hl + hh) / 2
    return output[: original_shape[0], : original_shape[1]]


def _image_blocks(shape: tuple[int, int]) -> list[tuple[int, int]]:
    height, width = shape
    return [
        (row, column)
        for row in range(0, height - 7, 8)
        for column in range(0, width - 7, 8)
    ]


def _image_bits(
    ll: np.ndarray,
    blocks: list[tuple[int, int]],
    payload: np.ndarray,
) -> None:
    repetitions = _repetitions(len(blocks))
    repeated = np.tile(payload, repetitions)
    for index, bit in enumerate(repeated):
        row, column = blocks[index]
        coefficients = dctn(ll[row : row + 8, column : column + 8], norm="ortho")
        bit_value = int(bit)
        coefficients[2, 3], coefficients[3, 2] = _qim_embed(
            coefficients[2, 3],
            coefficients[3, 2],
            bit_value,
            IMAGE_DELTA,
        )
        ll[row : row + 8, column : column + 8] = idctn(
            coefficients,
            norm="ortho",
        )


def embed_image(image_bytes: bytes, tx_hash: str) -> bytes:
    payload = _encode_payload(tx_hash)
    source = Image.open(io.BytesIO(image_bytes))
    image_format = source.format
    if image_format not in ("JPEG", "PNG", "WEBP"):
        raise ValueError("Only JPEG, PNG, and WebP images are supported")

    has_alpha = "A" in source.getbands()
    if source.mode in ("1", "L", "I", "F"):
        image = source.convert("L")
        luminance = np.asarray(image, dtype=np.float64)
        channels = None
    else:
        image = source.convert("RGBA" if has_alpha else "RGB")
        rgb = np.asarray(image.convert("RGB"), dtype=np.float64)
        luminance = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
        channels = rgb

    ll, details, shape = _haar_dwt2(luminance)
    _image_bits(ll, _image_blocks(ll.shape), payload)
    marked_luminance = np.clip(_haar_idwt2(ll, details, shape), 0, 255)

    if channels is None:
        output_image = Image.fromarray(marked_luminance.astype(np.uint8), mode="L")
    else:
        difference = marked_luminance - luminance
        channels = np.clip(channels + difference[:, :, np.newaxis], 0, 255)
        output_image = Image.fromarray(channels.astype(np.uint8), mode="RGB")
        if has_alpha:
            alpha = np.asarray(image.getchannel("A"), dtype=np.uint8)
            output_image.putalpha(Image.fromarray(alpha, mode="L"))

    output = io.BytesIO()
    save_options = {}
    if image_format == "JPEG":
        output_image = output_image.convert("RGB")
        save_options = {"quality": 95, "subsampling": 0}
    elif image_format == "WEBP":
        save_options = {"lossless": True, "method": 4}
    output_image.save(output, format=image_format, **save_options)
    return output.getvalue()


def _extract_image_bits(luminance: np.ndarray) -> np.ndarray | None:
    ll, _, _ = _haar_dwt2(luminance)
    blocks = _image_blocks(ll.shape)
    repetitions = min(MAX_REPETITIONS, len(blocks) // PAYLOAD_BITS)
    if repetitions < MIN_REPETITIONS:
        return None

    bits = np.empty(PAYLOAD_BITS * repetitions, dtype=np.uint8)
    for index in range(len(bits)):
        row, column = blocks[index]
        coefficients = dctn(ll[row : row + 8, column : column + 8], norm="ortho")
        bits[index] = _qim_read(
            coefficients[2, 3],
            coefficients[3, 2],
            IMAGE_DELTA,
        )
    return bits.reshape(repetitions, PAYLOAD_BITS).sum(axis=0) > repetitions // 2


def extract_image(image_bytes: bytes) -> str | None:
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    rgb = np.asarray(image, dtype=np.float64)
    luminance = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
    bits = _extract_image_bits(luminance)
    return _decode_payload(bits) if bits is not None else None


def _audio_frames(samples: np.ndarray) -> tuple[np.ndarray, int]:
    frame_count = len(samples) // AUDIO_FRAME_SIZE
    return samples[: frame_count * AUDIO_FRAME_SIZE], frame_count


def _audio_dwt_dct(frame: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    even = frame[0::2]
    odd = frame[1::2]
    low = (even + odd) / np.sqrt(2)
    high = (even - odd) / np.sqrt(2)
    return dctn(low, norm="ortho"), high


def _audio_inverse_dwt_dct(coefficients: np.ndarray, high: np.ndarray) -> np.ndarray:
    low = idctn(coefficients, norm="ortho")
    frame = np.empty(AUDIO_FRAME_SIZE, dtype=np.float64)
    frame[0::2] = (low + high) / np.sqrt(2)
    frame[1::2] = (low - high) / np.sqrt(2)
    return frame


def _audio_embed_samples(samples: np.ndarray, payload: np.ndarray) -> np.ndarray:
    mono = samples.mean(axis=1)
    frames, frame_count = _audio_frames(samples)
    repetitions = _repetitions(frame_count)
    bits = np.tile(payload, repetitions)

    for index, bit in enumerate(bits):
        start = index * AUDIO_FRAME_SIZE
        end = start + AUDIO_FRAME_SIZE
        coefficients, high = _audio_dwt_dct(mono[start:end])
        coefficients[34], coefficients[42] = _qim_embed(
            coefficients[34],
            coefficients[42],
            int(bit),
            AUDIO_DELTA,
        )
        changed = _audio_inverse_dwt_dct(coefficients, high)
        frames[start:end] += (changed - mono[start:end])[:, np.newaxis]
    return samples


def embed_audio(audio_bytes: bytes, tx_hash: str) -> bytes:
    payload = _encode_payload(tx_hash)
    samples, sample_rate = sf.read(
        io.BytesIO(audio_bytes),
        dtype="float32",
        always_2d=True,
    )
    _, frame_count = _audio_frames(samples)
    _repetitions(frame_count)
    marked_samples = _audio_embed_samples(samples.copy(), payload)

    output = io.BytesIO()
    sf.write(
        output,
        marked_samples,
        sample_rate,
        format="MP3",
        subtype="MPEG_LAYER_III",
    )
    return output.getvalue()


def extract_audio(audio_bytes: bytes) -> str | None:
    samples, _ = sf.read(
        io.BytesIO(audio_bytes),
        dtype="float32",
        always_2d=True,
    )
    mono = samples.mean(axis=1)
    _, frame_count = _audio_frames(samples)
    repetitions = min(MAX_REPETITIONS, frame_count // PAYLOAD_BITS)
    if repetitions < MIN_REPETITIONS:
        return None

    bits = np.empty(PAYLOAD_BITS * repetitions, dtype=np.uint8)
    for index in range(len(bits)):
        start = index * AUDIO_FRAME_SIZE
        end = start + AUDIO_FRAME_SIZE
        coefficients, _ = _audio_dwt_dct(mono[start:end])
        bits[index] = _qim_read(
            coefficients[34],
            coefficients[42],
            AUDIO_DELTA,
        )
    decoded = bits.reshape(repetitions, PAYLOAD_BITS).sum(axis=0) > repetitions // 2
    return _decode_payload(decoded)

from __future__ import annotations

import hashlib
import io
import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

router = APIRouter(
    prefix="/image-intelligence",
    tags=["Batch 13 - Image Intelligence"],
)

# In-memory lab index keeps this batch isolated from the existing database.
# Production persistence can be added later without changing the API contract.
IMAGE_INDEX: List[Dict[str, Any]] = []


class ImageFingerprintRequest(BaseModel):
    image_name: str = "synthetic-evidence.png"
    image_bytes_base64: str = ""
    source: str = "controlled_investigation_lab"
    actor_id: Optional[str] = None


class ImageCompareRequest(BaseModel):
    query_hash: str
    candidate_hashes: List[str] = Field(default_factory=list)


def _average_hash(data: bytes, size: int = 16) -> str:
    """Dependency-free perceptual-style hash using a deterministic byte grid."""
    if not data:
        return "0" * (size * size // 4)

    # Deterministically spread the byte stream over a square grid.
    total = size * size
    samples = []
    for i in range(total):
        idx = (i * 1315423911 + len(data) * 2654435761) % len(data)
        samples.append(data[idx])

    avg = sum(samples) / len(samples)
    bits = "".join("1" if value >= avg else "0" for value in samples)

    # Compact hexadecimal representation.
    return hex(int(bits, 2))[2:].zfill(math.ceil(len(bits) / 4))


def _hamming_distance(hash_a: str, hash_b: str) -> int:
    try:
        a = int(hash_a, 16)
        b = int(hash_b, 16)
        width = max(len(hash_a), len(hash_b)) * 4
        return (a ^ b).bit_count() if width else 0
    except (TypeError, ValueError):
        return 9999


def _similarity(hash_a: str, hash_b: str) -> float:
    distance = _hamming_distance(hash_a, hash_b)
    width = max(len(hash_a), len(hash_b)) * 4
    if width <= 0 or distance == 9999:
        return 0.0
    return round(max(0.0, 1.0 - (distance / width)), 4)


def _metadata(data: bytes, filename: str) -> Dict[str, Any]:
    """Extract safe basic metadata without claiming unavailable EXIF."""
    digest = hashlib.sha256(data).hexdigest()
    return {
        "filename": filename,
        "byte_size": len(data),
        "sha256": digest,
        "format_hint": filename.rsplit(".", 1)[-1].lower() if "." in filename else "unknown",
        "exif_available": False,
        "exif_note": "Basic metadata only in isolated prototype; EXIF parser can be added for supported image formats.",
    }


def _register(
    image_name: str,
    data: bytes,
    source: str,
    actor_id: Optional[str],
) -> Dict[str, Any]:
    image_hash = _average_hash(data)
    meta = _metadata(data, image_name)

    record = {
        "image_id": "IMG-" + meta["sha256"][:12].upper(),
        "image_name": image_name,
        "perceptual_hash": image_hash,
        "sha256": meta["sha256"],
        "metadata": meta,
        "source": source,
        "actor_id": actor_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Replace exact SHA-256 duplicates instead of creating duplicate evidence.
    existing = next((x for x in IMAGE_INDEX if x["sha256"] == record["sha256"]), None)
    if existing:
        return {**existing, "duplicate": True}

    IMAGE_INDEX.append(record)
    return {**record, "duplicate": False}


@router.get("/health")
def image_health():
    return {
        "status": "ok",
        "module": "DARKTRACE-X Image Intelligence",
        "mode": "controlled_synthetic_or_authorized_data",
        "indexed_images": len(IMAGE_INDEX),
    }


@router.post("/fingerprint")
def fingerprint_image(request: ImageFingerprintRequest):
    import base64

    if not request.image_bytes_base64:
        raise HTTPException(status_code=400, detail="image_bytes_base64 is required")

    try:
        data = base64.b64decode(request.image_bytes_base64, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid base64 image payload") from exc

    if not data:
        raise HTTPException(status_code=400, detail="Image payload is empty")

    return {
        "status": "accepted",
        "fingerprint": _register(
            request.image_name,
            data,
            request.source,
            request.actor_id,
        ),
        "assessment": {
            "identity_claim": "not_supported",
            "interpretation": "Perceptual similarity is evidence of possible reuse or transformation, not proof of common authorship.",
        },
    }


@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    source: str = "controlled_investigation_lab",
    actor_id: Optional[str] = None,
):
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    result = _register(file.filename or "uploaded-image", data, source, actor_id)
    return {
        "status": "accepted",
        "fingerprint": result,
        "assessment": {
            "identity_claim": "not_supported",
            "interpretation": "Image similarity supports correlation analysis only.",
        },
    }


@router.post("/compare")
def compare_images(request: ImageCompareRequest):
    results = []
    for candidate in request.candidate_hashes:
        score = _similarity(request.query_hash, candidate)
        if score >= 0.75:
            label = "strong_similarity"
        elif score >= 0.55:
            label = "moderate_similarity"
        elif score >= 0.35:
            label = "weak_similarity"
        else:
            label = "low_similarity"

        results.append({
            "candidate_hash": candidate,
            "similarity": score,
            "classification": label,
        })

    results.sort(key=lambda item: item["similarity"], reverse=True)
    return {
        "query_hash": request.query_hash,
        "matches": results,
        "assessment": "synthetic/authorized image-correlation assessment; not identity attribution",
    }


@router.get("/index")
def image_index():
    return {
        "count": len(IMAGE_INDEX),
        "images": IMAGE_INDEX,
    }

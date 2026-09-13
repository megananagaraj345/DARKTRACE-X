from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.signal import Signal
from app.models.post import Post
from app.extractors.stylometry import extract_stylometry
from app.fusion.fusion_engine import (
    calculate_fusion_score,
    classify_relationship
)

router = APIRouter(
    prefix="/signals",
    tags=["Signals"]
)


@router.post("/analyze/{post_id}")
def analyze_post(
    post_id: int,
    db: Session = Depends(get_db)
):
    post = db.query(Post).filter(Post.id == post_id).first()

    if not post:
        return {
            "error": "Post not found"
        }

    style_profile = extract_stylometry(post.text)

    signal_value = style_profile["average_word_length"]

    signal_confidence = min(
        1.0,
        style_profile["word_count"] / 20
    )

    signal = Signal(
        type="stylometry",
        source="basic_stylometry",
        value=signal_value,
        confidence=signal_confidence
    )

    db.add(signal)
    db.commit()
    db.refresh(signal)

    return {
        "signal_id": signal.id,
        "post_id": post.id,
        "signal_type": signal.type,
        "source": signal.source,
        "value": signal.value,
        "confidence": signal.confidence,
        "style_profile": style_profile
    }


@router.post("/fusion")
def fusion_signals(
    signals: list[dict]
):
    """
    Combine multiple intelligence signals
    using the DARKTRACE-X Fusion Engine v0.
    """

    score = calculate_fusion_score(signals)

    relationship = classify_relationship(score)

    return {
        "fusion_score": score,
        "relationship": relationship,
        "signal_count": len(signals),
        "signals": signals
    }


@router.get("/")
def get_signals(
    db: Session = Depends(get_db)
):
    signals = db.query(Signal).all()

    return signals
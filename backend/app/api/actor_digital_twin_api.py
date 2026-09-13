from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.database import get_db
from app.models.actor_digital_twin import ActorDigitalTwin


router = APIRouter(
    prefix="/actor-digital-twins",
    tags=["Actor Digital Twin"]
)


class ActorDigitalTwinRequest(BaseModel):
    actor_id: str
    display_name: str

    aliases: str | None = None
    platforms: str | None = None

    writing_style: str | None = None
    activity_pattern: str | None = None

    infrastructure: str | None = None
    wallets: str | None = None

    campaigns: str | None = None

    current_state: str | None = None
    state_confidence: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0
    )

    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0
    )

    risk_score: float = Field(
        default=0.0,
        ge=0.0,
        le=100.0
    )

    analyst_assessment: str | None = None


class ActorDigitalTwinUpdateRequest(BaseModel):
    display_name: str | None = None

    aliases: str | None = None
    platforms: str | None = None

    writing_style: str | None = None
    activity_pattern: str | None = None

    infrastructure: str | None = None
    wallets: str | None = None

    campaigns: str | None = None

    current_state: str | None = None
    state_confidence: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0
    )

    confidence: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0
    )

    risk_score: float | None = Field(
        default=None,
        ge=0.0,
        le=100.0
    )

    analyst_assessment: str | None = None


@router.post("/")
def create_actor_digital_twin(
    request: ActorDigitalTwinRequest,
    db: Session = Depends(get_db)
):
    """
    Create an Actor Digital Twin.

    The digital twin represents an evolving intelligence
    profile based on observed and assessed information.

    It does NOT represent a confirmed real-world identity.
    """

    existing_actor = (
        db.query(ActorDigitalTwin)
        .filter(
            ActorDigitalTwin.actor_id == request.actor_id
        )
        .first()
    )

    if existing_actor:
        return {
            "error": "Actor Digital Twin already exists",
            "actor_id": existing_actor.actor_id
        }

    actor = ActorDigitalTwin(
        actor_id=request.actor_id,
        display_name=request.display_name,
        aliases=request.aliases,
        platforms=request.platforms,
        writing_style=request.writing_style,
        activity_pattern=request.activity_pattern,
        infrastructure=request.infrastructure,
        wallets=request.wallets,
        campaigns=request.campaigns,
        current_state=request.current_state,
        state_confidence=request.state_confidence,
        confidence=request.confidence,
        risk_score=request.risk_score,
        analyst_assessment=request.analyst_assessment
    )

    db.add(actor)
    db.commit()
    db.refresh(actor)

    return {
        "status": "actor_digital_twin_created",
        "actor_id": actor.actor_id,
        "display_name": actor.display_name,
        "confidence": actor.confidence,
        "risk_score": actor.risk_score,
        "current_state": actor.current_state,
        "state_confidence": actor.state_confidence
    }


@router.put("/{actor_id}")
def update_actor_digital_twin(
    actor_id: str,
    request: ActorDigitalTwinUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    Update an existing Actor Digital Twin.

    Only fields provided in the request are changed.
    """

    actor = (
        db.query(ActorDigitalTwin)
        .filter(
            ActorDigitalTwin.actor_id == actor_id
        )
        .first()
    )

    if not actor:
        return {
            "error": "Actor Digital Twin not found",
            "actor_id": actor_id
        }

    update_data = request.model_dump(
        exclude_unset=True
    )

    for field, value in update_data.items():
        setattr(actor, field, value)

    db.commit()
    db.refresh(actor)

    return {
        "status": "actor_digital_twin_updated",
        "actor_id": actor.actor_id,
        "display_name": actor.display_name,
        "confidence": actor.confidence,
        "risk_score": actor.risk_score,
        "current_state": actor.current_state,
        "state_confidence": actor.state_confidence,
        "updated_fields": list(update_data.keys())
    }


@router.get("/")
def get_actor_digital_twins(
    db: Session = Depends(get_db)
):
    """
    Return all Actor Digital Twins.
    """

    actors = (
        db.query(ActorDigitalTwin)
        .order_by(
            ActorDigitalTwin.id.desc()
        )
        .all()
    )

    return actors


@router.get("/{actor_id}")
def get_actor_digital_twin(
    actor_id: str,
    db: Session = Depends(get_db)
):
    """
    Return a specific Actor Digital Twin.
    """

    actor = (
        db.query(ActorDigitalTwin)
        .filter(
            ActorDigitalTwin.actor_id == actor_id
        )
        .first()
    )

    if not actor:
        return {
            "error": "Actor Digital Twin not found"
        }

    return actor
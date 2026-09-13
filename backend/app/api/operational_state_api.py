from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.database import get_db
from app.models.operational_state import OperationalState
from app.pipeline.operational_state_engine import reconstruct_operational_state


router = APIRouter(
    prefix="/operational-state",
    tags=["Operational State"]
)


class OperationalSignal(BaseModel):
    type: str
    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0
    )
    weight: float = Field(
        default=1.0,
        ge=0.0
    )
    description: str | None = None


class OperationalStateRequest(BaseModel):
    actor_id: str
    signals: list[OperationalSignal]


@router.post("/reconstruct")
def reconstruct_state(
    request: OperationalStateRequest,
    db: Session = Depends(get_db)
):
    """
    Reconstruct the current operational state of an actor
    using observed intelligence signals.

    This produces an intelligence assessment and does not
    represent confirmed real-world attribution.
    """

    signals = [
        signal.model_dump()
        for signal in request.signals
    ]

    result = reconstruct_operational_state(
        signals
    )

    operational_state = OperationalState(
        actor_id=request.actor_id,
        current_state=result["current_state"],
        state_confidence=result["state_confidence"],
        supporting_evidence=" | ".join(
            result["supporting_evidence"]
        ),
        contradictory_evidence=" | ".join(
            result["contradictory_evidence"]
        ),
        evidence_count=result["evidence_count"],
        assessment=result["assessment"]
    )

    db.add(operational_state)
    db.commit()
    db.refresh(operational_state)

    return {
        "status": "operational_state_reconstructed",
        "state_id": operational_state.id,
        "actor_id": operational_state.actor_id,
        "current_state": operational_state.current_state,
        "state_confidence": operational_state.state_confidence,
        "state_scores": result["state_scores"],
        "supporting_evidence": result["supporting_evidence"],
        "contradictory_evidence": result["contradictory_evidence"],
        "evidence_count": result["evidence_count"],
        "assessment": result["assessment"]
    }


@router.get("/")
def get_operational_states(
    db: Session = Depends(get_db)
):
    """
    Return all operational state assessments.
    """

    states = (
        db.query(OperationalState)
        .order_by(
            OperationalState.id.desc()
        )
        .all()
    )

    return states


@router.get("/{actor_id}")
def get_actor_operational_states(
    actor_id: str,
    db: Session = Depends(get_db)
):
    """
    Return the operational state history of one actor.
    """

    states = (
        db.query(OperationalState)
        .filter(
            OperationalState.actor_id == actor_id
        )
        .order_by(
            OperationalState.id.desc()
        )
        .all()
    )

    return states
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.database import get_db
from app.models.timeline_event import TimelineEvent
from app.pipeline.activity_replay_engine import reconstruct_activity_replay


router = APIRouter(
    prefix="/activity-replay",
    tags=["Activity Replay"]
)


class TimelineEventRequest(BaseModel):
    actor_id: str
    event_type: str
    description: str
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    source: str | None = None
    related_entity: str | None = None
    operational_state: str | None = None


class ActivityReplaySignal(BaseModel):
    type: str
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    description: str | None = None
    source: str | None = None
    related_entity: str | None = None


class ActivityReplayRequest(BaseModel):
    actor_id: str
    signals: list[ActivityReplaySignal]


@router.post("/events")
def create_timeline_event(
    request: TimelineEventRequest,
    db: Session = Depends(get_db)
):
    event = TimelineEvent(
        actor_id=request.actor_id,
        event_type=request.event_type,
        description=request.description,
        confidence=request.confidence,
        source=request.source,
        related_entity=request.related_entity,
        operational_state=request.operational_state
    )

    db.add(event)
    db.commit()
    db.refresh(event)

    return {
        "status": "timeline_event_created",
        "event_id": event.id,
        "actor_id": event.actor_id,
        "event_type": event.event_type,
        "description": event.description,
        "confidence": event.confidence,
        "source": event.source,
        "related_entity": event.related_entity,
        "operational_state": event.operational_state,
        "timestamp": event.timestamp
    }


@router.post("/reconstruct")
def reconstruct_and_store_activity(
    request: ActivityReplayRequest,
    db: Session = Depends(get_db)
):
    signals = [
        signal.model_dump()
        for signal in request.signals
    ]

    result = reconstruct_activity_replay(
        actor_id=request.actor_id,
        signals=signals
    )

    stored_events = []

    for event_data in result["events"]:
        event = TimelineEvent(
            actor_id=event_data["actor_id"],
            event_type=event_data["event_type"],
            description=event_data["description"],
            confidence=event_data["confidence"],
            source=event_data["source"],
            related_entity=event_data["related_entity"],
            operational_state=event_data["operational_state"]
        )

        db.add(event)
        db.flush()

        stored_events.append({
            "event_id": event.id,
            "actor_id": event.actor_id,
            "event_type": event.event_type,
            "description": event.description,
            "confidence": event.confidence,
            "source": event.source,
            "related_entity": event.related_entity,
            "operational_state": event.operational_state,
            "timestamp": event.timestamp
        })

    db.commit()

    return {
        "status": "activity_replay_reconstructed",
        "actor_id": request.actor_id,
        "event_count": len(stored_events),
        "events": stored_events,
        "ignored_signal_count": result["ignored_signal_count"],
        "ignored_signals": result["ignored_signals"]
    }


@router.get("/")
def get_all_timeline_events(
    db: Session = Depends(get_db)
):
    events = (
        db.query(TimelineEvent)
        .order_by(TimelineEvent.timestamp.asc())
        .all()
    )

    return events


@router.get("/{actor_id}")
def get_actor_activity_replay(
    actor_id: str,
    db: Session = Depends(get_db)
):
    events = (
        db.query(TimelineEvent)
        .filter(TimelineEvent.actor_id == actor_id)
        .order_by(TimelineEvent.timestamp.asc())
        .all()
    )

    return {
        "actor_id": actor_id,
        "event_count": len(events),
        "timeline": events
    }
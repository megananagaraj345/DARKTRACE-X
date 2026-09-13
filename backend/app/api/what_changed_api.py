from fastapi import APIRouter
from pydantic import BaseModel

from app.pipeline.what_changed_engine import analyze_actor_changes


router = APIRouter(
    prefix="/what-changed",
    tags=["What Changed"]
)


class ActorSnapshot(BaseModel):
    actor_id: str
    display_name: str | None = None
    aliases: str | None = None
    platforms: str | None = None
    writing_style: str | None = None
    activity_pattern: str | None = None
    infrastructure: str | None = None
    wallets: str | None = None
    campaigns: str | None = None
    current_state: str | None = None
    state_confidence: float | None = None
    confidence: float | None = None
    risk_score: float | None = None
    analyst_assessment: str | None = None


class WhatChangedRequest(BaseModel):
    previous: ActorSnapshot
    current: ActorSnapshot


@router.post("/compare")
def compare_actor_snapshots(
    request: WhatChangedRequest
):
    previous = request.previous.model_dump()
    current = request.current.model_dump()

    result = analyze_actor_changes(
        previous=previous,
        current=current
    )

    return {
        "status": "comparison_completed",
        "actor_id": result["actor_id"],
        "change_count": result["change_count"],
        "changes": result["changes"],
        "summary": result["summary"]
    }
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import uuid

from app.database import get_db
from app.models.campaign import Campaign
from app.pipeline.campaign_detection_engine import (
    detect_emerging_campaign
)


router = APIRouter(
    prefix="/campaigns",
    tags=["Campaign Detection"]
)


class CampaignSignal(BaseModel):

    type: str

    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0
    )

    description: str | None = None

    source: str | None = None

    related_entity: str | None = None


class CampaignDetectionRequest(BaseModel):

    actor_id: str | None = None

    signals: list[CampaignSignal]


@router.post("/detect")
def detect_campaign(
    request: CampaignDetectionRequest,
    db: Session = Depends(get_db)
):

    signals = [
        signal.model_dump()
        for signal in request.signals
    ]

    result = detect_emerging_campaign(
        actor_id=request.actor_id,
        signals=signals
    )

    campaign = Campaign(
        campaign_id=f"campaign_{uuid.uuid4().hex[:12]}",
        name=result["campaign_name"],
        actor_id=result["actor_id"],
        confidence=result["confidence"],
        status=result["status"],
        signal_count=result["signal_count"],
        supporting_evidence=" | ".join(
            result["supporting_evidence"]
        ),
        related_entities=" | ".join(
            result["related_entities"]
        ),
        assessment=result["assessment"]
    )

    db.add(campaign)

    db.commit()

    db.refresh(campaign)

    return {
        "status": "campaign_detection_completed",
        "campaign_id": campaign.campaign_id,
        "campaign_name": campaign.name,
        "actor_id": campaign.actor_id,
        "confidence": campaign.confidence,
        "campaign_status": campaign.status,
        "signal_count": campaign.signal_count,
        "supporting_evidence": result[
            "supporting_evidence"
        ],
        "related_entities": result[
            "related_entities"
        ],
        "assessment": result[
            "assessment"
        ],
        "ignored_signal_count": result[
            "ignored_signal_count"
        ]
    }


@router.get("/")
def get_campaigns(
    db: Session = Depends(get_db)
):

    campaigns = (
        db.query(Campaign)
        .order_by(
            Campaign.id.desc()
        )
        .all()
    )

    return campaigns


@router.get("/{campaign_id}")
def get_campaign(
    campaign_id: str,
    db: Session = Depends(get_db)
):

    campaign = (
        db.query(Campaign)
        .filter(
            Campaign.campaign_id == campaign_id
        )
        .first()
    )

    if not campaign:

        return {
            "error": "Campaign not found",
            "campaign_id": campaign_id
        }

    return campaign
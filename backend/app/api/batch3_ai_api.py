from typing import Any, Dict, List

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.pipeline.batch3_ai_engine import (
    adversarial_demo,
    counter_evidence_analysis,
    early_warning,
    what_if_forecast,
)

router = APIRouter(
    prefix="/advanced-ai",
    tags=["Advanced AI / Resilience"],
)


class WhatIfRequest(BaseModel):
    current_state: str = "Preparation"
    risk_score: float = 70
    state_confidence: float = 0.74
    campaign_confidence: float = 0.0
    change_count: int = 0


class CounterEvidenceRequest(BaseModel):
    supporting_evidence: List[Dict[str, Any]] = Field(
        default_factory=list
    )
    contradictory_evidence: List[Dict[str, Any]] = Field(
        default_factory=list
    )
    base_confidence: float = 0.75


class AdversarialRequest(BaseModel):
    base_confidence: float = 0.82
    injected_signal: str = "shared_infrastructure"
    counter_evidence: List[Dict[str, Any]] = Field(
        default_factory=list
    )


class EarlyWarningRequest(BaseModel):
    risk_score: float = 70
    current_state: str = "Preparation"
    predicted_state: str = "Operational Activity"
    prediction_probability: float = 0.80
    change_count: int = 0
    campaign_confidence: float = 0.0
    adjusted_confidence: float = 0.75
    false_link_risk: float = 0.0


@router.post("/what-if")
def what_if(request: WhatIfRequest):
    return what_if_forecast(
        **request.model_dump()
    )


@router.post("/counter-evidence")
def counter_evidence(request: CounterEvidenceRequest):
    data = request.model_dump()

    return counter_evidence_analysis(
        supporting=data["supporting_evidence"],
        contradictory=data["contradictory_evidence"],
        base_confidence=data["base_confidence"],
    )


@router.post("/adversarial-demo")
def adversarial(request: AdversarialRequest):
    return adversarial_demo(
        **request.model_dump()
    )


@router.post("/early-warning")
def warning(request: EarlyWarningRequest):
    return early_warning(
        **request.model_dump()
    )
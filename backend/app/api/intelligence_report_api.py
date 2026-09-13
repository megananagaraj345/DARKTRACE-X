from typing import Any, Dict, List

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.pipeline.intelligence_report_engine import (
    build_analyst_summary,
    generate_intelligence_report,
    map_mitre_attack,
)


router = APIRouter(
    prefix="/intelligence-report",
    tags=["Batch 4 - Intelligence Reporting"],
)


class IntelligenceReportRequest(BaseModel):
    actor_id: str = "ACTOR-SYNTH-001"

    aliases: List[str] = Field(default_factory=list)
    platforms: List[str] = Field(default_factory=list)

    writing_style: str = ""
    activity_pattern: str = ""

    infrastructure: List[str] = Field(default_factory=list)
    blockchain_signals: List[str] = Field(default_factory=list)
    campaigns: List[str] = Field(default_factory=list)

    timeline: List[Dict[str, Any]] = Field(default_factory=list)

    current_state: str = "Preparation"
    risk_score: float = 70
    state_confidence: float = 0.75

    predicted_state: str = "Operational Activity"
    prediction_probability: float = 0.80

    what_changed: List[str] = Field(default_factory=list)
    supporting_evidence: List[str] = Field(default_factory=list)
    contradictory_evidence: List[str] = Field(default_factory=list)

    signal_types: List[str] = Field(default_factory=list)
    change_types: List[str] = Field(default_factory=list)

    indicators: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)


class MitreRequest(BaseModel):
    current_state: str = "Preparation"
    signal_types: List[str] = Field(default_factory=list)
    change_types: List[str] = Field(default_factory=list)
    confidence: float = 0.75


class AnalystSummaryRequest(BaseModel):
    actor_id: str = "ACTOR-SYNTH-001"
    current_state: str = "Preparation"
    risk_score: float = 70
    confidence: float = 0.75
    predicted_state: str = "Operational Activity"
    prediction_probability: float = 0.80

    what_changed: List[str] = Field(default_factory=list)
    supporting_evidence: List[str] = Field(default_factory=list)
    contradictory_evidence: List[str] = Field(default_factory=list)


@router.post("/generate")
def generate_report(request: IntelligenceReportRequest):
    return generate_intelligence_report(**request.model_dump())


@router.post("/mitre")
def mitre_mapping(request: MitreRequest):
    return {
        "techniques": map_mitre_attack(**request.model_dump()),
        "assessment_type": "synthetic intelligence mapping",
    }


@router.post("/analyst-summary")
def analyst_summary(request: AnalystSummaryRequest):
    return build_analyst_summary(**request.model_dump())


@router.get("/health")
def intelligence_report_health():
    return {
        "status": "ok",
        "module": "DARKTRACE-X Batch 4 Intelligence Reporting",
        "version": "1.0",
    }

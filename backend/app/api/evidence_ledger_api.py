from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.evidence_ledger import EvidenceLedger


router = APIRouter(
    prefix="/evidence-ledger",
    tags=["Evidence Ledger"]
)


class EvidenceLedgerRequest(BaseModel):
    entity_a: str
    entity_b: str | None = None
    claim: str
    observation: str
    signal_type: str
    signal_value: float | None = None
    model_result: str | None = None
    fusion_score: float | None = None
    confidence: float
    analyst_assessment: str | None = None
    source: str | None = None


@router.post("/")
def create_evidence_ledger(
    request: EvidenceLedgerRequest,
    db: Session = Depends(get_db)
):
    """
    Create an evidence ledger entry.

    The ledger records the reasoning chain behind
    a DARKTRACE-X intelligence assessment.
    """

    confidence = max(
        0.0,
        min(1.0, request.confidence)
    )

    ledger = EvidenceLedger(
        entity_a=request.entity_a,
        entity_b=request.entity_b,
        claim=request.claim,
        observation=request.observation,
        signal_type=request.signal_type,
        signal_value=request.signal_value,
        model_result=request.model_result,
        fusion_score=request.fusion_score,
        confidence=confidence,
        analyst_assessment=request.analyst_assessment,
        source=request.source
    )

    db.add(ledger)
    db.commit()
    db.refresh(ledger)

    return {
        "ledger_id": ledger.id,
        "entity_a": ledger.entity_a,
        "entity_b": ledger.entity_b,
        "claim": ledger.claim,
        "observation": ledger.observation,
        "signal_type": ledger.signal_type,
        "signal_value": ledger.signal_value,
        "model_result": ledger.model_result,
        "fusion_score": ledger.fusion_score,
        "confidence": ledger.confidence,
        "analyst_assessment": ledger.analyst_assessment,
        "source": ledger.source,
        "status": "evidence_recorded"
    }


@router.get("/")
def get_evidence_ledger(
    db: Session = Depends(get_db)
):
    """
    Return all evidence ledger entries.
    """

    entries = (
        db.query(EvidenceLedger)
        .order_by(EvidenceLedger.id.desc())
        .all()
    )

    return entries
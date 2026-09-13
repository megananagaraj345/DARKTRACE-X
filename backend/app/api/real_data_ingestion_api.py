from datetime import datetime, timezone
import hashlib
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.database import SessionLocal
from app.models.evidence_ledger import EvidenceLedger
from app.models.signal import Signal

router = APIRouter(
    prefix="/intelligence-ingestion",
    tags=["Batch 12 - Authorized CTI Ingestion"],
)

SUPPORTED_FORMATS = {"generic", "stix-like", "csv-normalized", "json"}


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, float(value)))


def _text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _first(record: Dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = _text(record.get(key))
        if value:
            return value
    return ""


def normalize_record(record: Dict[str, Any], source: str) -> Dict[str, Any]:
    actor_id = _first(record, "actor_id", "persona_id", "threat_actor", "identity", "subject")
    entity = _first(record, "entity", "indicator", "value", "observable", "target")
    signal_type = _first(record, "signal_type", "type", "indicator_type", "observable_type") or "external_cti_observation"
    observation = _first(record, "observation", "description", "context", "comment", "name")
    confidence_raw = record.get("confidence", record.get("score", 0.70))
    try:
        confidence = _clamp(float(confidence_raw))
    except (TypeError, ValueError):
        confidence = 0.70

    timestamp = _first(record, "timestamp", "created", "modified", "first_seen", "last_seen")
    if not timestamp:
        timestamp = datetime.now(timezone.utc).isoformat()

    if not actor_id:
        actor_id = "UNRESOLVED-CTI-ENTITY"
    if not entity:
        entity = "unresolved-observable"
    if not observation:
        observation = f"Authorized/public CTI observation of type '{signal_type}'."

    canonical = f"{actor_id}|{signal_type}|{entity}|{observation}|{source}".encode("utf-8")
    evidence_id = "CTI-" + hashlib.sha256(canonical).hexdigest()[:12].upper()

    return {
        "evidence_id": evidence_id,
        "actor_id": actor_id,
        "entity": entity,
        "signal_type": signal_type,
        "observation": observation,
        "confidence": round(confidence, 4),
        "source": source,
        "timestamp": timestamp,
    }


class IngestionRequest(BaseModel):
    source: str = Field(default="authorized_public_cti", min_length=1, max_length=200)
    format: str = Field(default="generic", min_length=1, max_length=50)
    records: List[Dict[str, Any]] = Field(default_factory=list, max_length=1000)
    dry_run: bool = False


class SingleRecordRequest(BaseModel):
    source: str = Field(default="authorized_public_cti", min_length=1, max_length=200)
    format: str = Field(default="generic", min_length=1, max_length=50)
    record: Dict[str, Any] = Field(default_factory=dict)
    dry_run: bool = False


@router.get("/health")
def ingestion_health():
    return {
        "status": "ok",
        "module": "DARKTRACE-X Authorized CTI Ingestion",
        "version": "1.0",
        "supported_formats": sorted(SUPPORTED_FORMATS),
        "mode": "public_or_authorized_data_only",
    }


@router.post("/preview")
def preview(request: IngestionRequest):
    if request.format.lower() not in SUPPORTED_FORMATS:
        raise HTTPException(status_code=400, detail="Unsupported ingestion format")
    normalized = [normalize_record(record, request.source) for record in request.records]
    return {
        "status": "preview",
        "source": request.source,
        "format": request.format,
        "records_received": len(request.records),
        "records_normalized": len(normalized),
        "records": normalized,
        "write_performed": False,
    }


@router.post("/ingest")
def ingest(request: IngestionRequest):
    if request.format.lower() not in SUPPORTED_FORMATS:
        raise HTTPException(status_code=400, detail="Unsupported ingestion format")
    if not request.records:
        raise HTTPException(status_code=400, detail="records must contain at least one item")

    normalized = [normalize_record(record, request.source) for record in request.records]
    if request.dry_run:
        return {
            "status": "dry_run",
            "records_received": len(request.records),
            "records_normalized": len(normalized),
            "stored": 0,
            "records": normalized,
        }

    db = SessionLocal()
    stored = 0
    signal_ids: List[int] = []
    try:
        for item in normalized:
            signal = Signal(
                type=item["signal_type"],
                source=item["source"],
                value=item["confidence"],
                confidence=item["confidence"],
            )
            db.add(signal)
            db.flush()
            signal_ids.append(signal.id)

            ledger = EvidenceLedger(
                entity_a=item["actor_id"],
                entity_b=item["entity"],
                claim=f"External CTI signal may be relevant to {item['actor_id']}",
                observation=item["observation"],
                signal_type=item["signal_type"],
                signal_value=item["confidence"],
                model_result="normalized_external_cti_observation",
                fusion_score=item["confidence"],
                confidence=item["confidence"],
                analyst_assessment="Requires correlation with independent evidence; ingestion alone is not attribution.",
                source=item["source"],
            )
            db.add(ledger)
            stored += 1

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    return {
        "status": "ingested",
        "records_received": len(request.records),
        "records_normalized": len(normalized),
        "stored": stored,
        "signal_ids": signal_ids,
        "source": request.source,
        "format": request.format,
        "assessment": "External data is evidence for correlation, not proof of actor identity.",
    }


@router.post("/ingest-one")
def ingest_one(request: SingleRecordRequest):
    batch = IngestionRequest(
        source=request.source,
        format=request.format,
        records=[request.record],
        dry_run=request.dry_run,
    )
    return ingest(batch)

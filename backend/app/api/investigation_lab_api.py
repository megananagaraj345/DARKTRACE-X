from datetime import datetime, timezone
import hashlib

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/investigation-lab", tags=["Batch 7 - Controlled Investigation Lab"])


class InjectionRequest(BaseModel):
    actor_id: str = "actor_beta_002"
    event_type: str = "synthetic_activity"
    signal_type: str = "shared_infrastructure"


@router.get("/health")
def lab_health():
    return {"status": "ok", "module": "DARKTRACE-X Controlled Investigation Lab", "mode": "synthetic_authorized_only"}


@router.post("/inject")
def inject_activity(request: InjectionRequest):
    now = datetime.now(timezone.utc)
    seed = f"{request.actor_id}:{now.isoformat()}".encode()
    event_id = "LAB-" + hashlib.sha256(seed).hexdigest()[:10].upper()
    signal_map = {
        "shared_alias": ("night_vector", 0.95),
        "shared_infrastructure": ("synthetic-server-cluster-b", 0.90),
        "shared_campaign": ("synthetic credential access campaign", 0.90),
        "shared_stylometry": ("short technical sentences", 0.82),
        "shared_temporal_pattern": ("active during late UTC hours", 0.72),
    }
    value, confidence = signal_map.get(request.signal_type, ("synthetic correlated activity", 0.78))
    return {
        "status": "accepted",
        "mode": "controlled_synthetic_investigation",
        "event": {
            "event_id": event_id,
            "actor_id": request.actor_id,
            "event_type": request.event_type,
            "timestamp": now.isoformat(),
            "description": "Synthetic investigation activity injected into the authorized DARKTRACE-X lab.",
        },
        "signal": {
            "type": request.signal_type,
            "value": value,
            "confidence": confidence,
            "source": "controlled_investigation_lab",
        },
        "assessment": {
            "correlation": round(confidence, 2),
            "recommended_action": "validate independent evidence before attribution-sensitive action",
            "attribution_status": "not_confirmed",
        },
    }

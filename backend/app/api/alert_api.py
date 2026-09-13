from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.pipeline.alert_engine import generate_intelligence_alert


router = APIRouter(
    prefix="/intelligence-alert",
    tags=["Intelligence Alerts"]
)


class AlertChange(BaseModel):
    field: str
    added: list[str] = Field(default_factory=list)
    removed: list[str] = Field(default_factory=list)
    changed: bool = False
    old_value: str | float | int | None = None
    new_value: str | float | int | None = None
    difference: float | None = None


class AlertRequest(BaseModel):
    actor_id: str
    current_state: str
    predicted_state: str
    prediction_probability: float = Field(
        ge=0.0,
        le=1.0
    )
    risk_score: float = Field(
        ge=0.0,
        le=100.0
    )
    changes: list[AlertChange] = Field(
        default_factory=list
    )


@router.post("/generate")
def generate_alert(request: AlertRequest):

    changes = [
        change.model_dump()
        for change in request.changes
    ]

    result = generate_intelligence_alert(
        actor_id=request.actor_id,
        risk_score=request.risk_score,
        current_state=request.current_state,
        predicted_state=request.predicted_state,
        prediction_probability=request.prediction_probability,
        changes=changes,
    )

    return {
        "status": "intelligence_alert_generated",
        **result,
    }
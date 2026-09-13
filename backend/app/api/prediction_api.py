from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.pipeline.prediction_engine import predict_next_activity


router = APIRouter(
    prefix="/prediction",
    tags=["Predictive Threat Intelligence"]
)


class PredictionSignal(BaseModel):
    type: str
    confidence: float = Field(ge=0.0, le=1.0)
    description: str | None = None
    source: str | None = None
    related_entity: str | None = None


class PredictionRequest(BaseModel):
    actor_id: str
    current_state: str
    state_confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0
    )
    risk_score: float = Field(
        default=0.0,
        ge=0.0,
        le=100.0
    )
    signals: list[PredictionSignal] = Field(
        default_factory=list
    )


@router.post("/predict")
def predict_threat_activity(request: PredictionRequest):

    signals = [
        signal.model_dump()
        for signal in request.signals
    ]

    result = predict_next_activity(
        actor_id=request.actor_id,
        current_state=request.current_state,
        state_confidence=request.state_confidence,
        risk_score=request.risk_score,
        signals=signals,
    )

    return {
        "status": "prediction_completed",
        **result,
    }
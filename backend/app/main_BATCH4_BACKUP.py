from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.persona_api import router as persona_router
from app.api.post_api import router as post_router
from app.api.signal_api import router as signal_router
from app.api.edge_api import router as edge_router
from app.api.graph_api import router as graph_router
from app.api.evidence_ledger_api import router as evidence_ledger_router
from app.api.actor_digital_twin_api import router as actor_digital_twin_router
from app.api.operational_state_api import router as operational_state_router
from app.api.activity_replay_api import router as activity_replay_router
from app.api.what_changed_api import router as what_changed_router
from app.api.campaign_api import router as campaign_router
from app.api.multi_actor_relationship_api import router as multi_actor_relationship_router
from app.api.prediction_api import router as prediction_router
from app.api.alert_api import router as alert_router
from app.api.batch3_ai_api import router as batch3_ai_router


app = FastAPI(
    title="DARKTRACE-X",
    description="Evidence-Driven Dark-Web Threat Intelligence Platform",
    version="0.1.0"
)


# Allow the Vite/React frontend to communicate with the local FastAPI backend.
# This is restricted to local development origins used by DARKTRACE-X.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Core APIs
app.include_router(persona_router)
app.include_router(post_router)
app.include_router(signal_router)
app.include_router(edge_router)
app.include_router(graph_router)

# Intelligence APIs
app.include_router(evidence_ledger_router)
app.include_router(actor_digital_twin_router)
app.include_router(operational_state_router)
app.include_router(activity_replay_router)
app.include_router(what_changed_router)
app.include_router(campaign_router)
app.include_router(multi_actor_relationship_router)
app.include_router(prediction_router)

# Intelligence Alert API
app.include_router(alert_router)
app.include_router(batch3_ai_router)


@app.get("/")
def root():
    return {
        "project": "DARKTRACE-X",
        "status": "online",
        "version": "0.1.0"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }

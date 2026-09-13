from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.database import get_db
from app.models.edge import Edge
from app.fusion.fusion_engine import (
    calculate_fusion_score,
    classify_relationship
)
from app.graph.graph_service import create_relationship_edge


router = APIRouter(
    prefix="/edges",
    tags=["Edges"]
)


class EdgeRequest(BaseModel):
    persona_a: str
    persona_b: str
    signals: list[dict] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)


@router.post("/")
def create_edge(
    request: EdgeRequest,
    db: Session = Depends(get_db)
):
    """
    Create a relationship edge between two personas.

    The relationship is stored in:
    1. PostgreSQL
    2. Neo4j

    Evidence is stored in Neo4j for explainability.
    """

    # --------------------------------------------------
    # Calculate fusion score
    # --------------------------------------------------

    score = calculate_fusion_score(request.signals)

    relationship = classify_relationship(score)

    # --------------------------------------------------
    # Save relationship to PostgreSQL
    # --------------------------------------------------

    edge = Edge(
        persona_a=request.persona_a,
        persona_b=request.persona_b,
        confidence=score,
        status=relationship
    )

    db.add(edge)
    db.commit()
    db.refresh(edge)

    # --------------------------------------------------
    # Sync relationship + evidence to Neo4j
    # --------------------------------------------------

    create_relationship_edge(
        persona_a=request.persona_a,
        persona_b=request.persona_b,
        confidence=score,
        status=relationship,
        evidence=request.evidence
    )

    # --------------------------------------------------
    # Return result
    # --------------------------------------------------

    return {
        "edge_id": edge.id,
        "persona_a": edge.persona_a,
        "persona_b": edge.persona_b,
        "confidence": edge.confidence,
        "status": edge.status,
        "signal_count": len(request.signals),
        "evidence_count": len(request.evidence),
        "evidence": request.evidence,
        "neo4j_synced": True
    }


@router.get("/")
def get_edges(
    db: Session = Depends(get_db)
):
    edges = db.query(Edge).all()

    return edges
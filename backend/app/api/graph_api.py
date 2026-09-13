from fastapi import APIRouter

from app.graph.graph_service import (
    get_persona_graph,
    get_multi_actor_graph,
    get_intelligence_graph
)

from app.graph.evidence_graph_service import (
    create_evidence_graph,
    get_evidence_graph
)


router = APIRouter(
    prefix="/graph",
    tags=["Threat Intelligence Graph"]
)


@router.get("/personas")
def get_persona_graph_data():
    graph = get_persona_graph()

    return {
        "status": "persona_graph_retrieved",
        "relationship_count": len(graph),
        "relationships": graph
    }


@router.get("/multi-actor")
def get_multi_actor_graph_data():
    graph = get_multi_actor_graph()

    return {
        "status": "multi_actor_graph_retrieved",
        "relationship_count": len(graph),
        "relationships": graph
    }


@router.get("/intelligence")
def get_intelligence_graph_data():
    """
    Returns the unified DARKTRACE-X intelligence graph.

    This endpoint is designed for the analyst workbench
    and future React/D3 visualization layer.
    """

    graph = get_intelligence_graph()

    return {
        "status": "intelligence_graph_retrieved",
        "graph": graph
    }


@router.post("/evidence")
def create_evidence_graph_data(request: dict):
    """
    Creates an explainable evidence graph.

    Synthetic investigation data only.
    """

    actor_a = request.get("actor_a")
    actor_b = request.get("actor_b")
    evidence = request.get("evidence", [])
    confidence = request.get("confidence", 0.0)
    relationship_type = request.get(
        "relationship_type",
        "intelligence_relationship"
    )

    if not actor_a or not actor_b:
        return {
            "status": "invalid_request",
            "message": "actor_a and actor_b are required"
        }

    result = create_evidence_graph(
        actor_a=actor_a,
        actor_b=actor_b,
        evidence=evidence,
        confidence=confidence,
        relationship_type=relationship_type
    )

    return {
        "status": "evidence_graph_created",
        "actor_a": actor_a,
        "actor_b": actor_b,
        "relationship_type": relationship_type,
        "confidence": confidence,
        **result
    }


@router.get("/evidence")
def get_evidence_graph_data():
    """
    Retrieves the explainable evidence graph
    from Neo4j.
    """

    graph = get_evidence_graph()

    return {
        "status": "evidence_graph_retrieved",
        "graph": graph
    }
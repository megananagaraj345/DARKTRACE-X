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
@router.post("/seed-demo")
def seed_demo_graph():
    """
    Seeds synthetic DARKTRACE-X demonstration graph data.
    """

    from app.graph.evidence_graph_service import _get_neo4j_session

    cloud_driver = None
    session = None

    try:
        cloud_driver, session = _get_neo4j_session()

        query = """
        MATCH (n)
        WHERE n:Persona
           OR n:EvidenceNode
           OR n:RelationshipAssessment
        DETACH DELETE n;

        CREATE
        (a:Persona {
            id: "actor_001",
            platform: "synthetic",
            username: "shadowfox"
        }),

        (b:Persona {
            id: "actor_002",
            platform: "synthetic",
            username: "nightowl"
        }),

        (c:Persona {
            id: "actor_003",
            platform: "synthetic",
            username: "darkorbit"
        }),

        (d:Persona {
            id: "actor_004",
            platform: "synthetic",
            username: "cipherwolf"
        }),

        (a)-[:RELATED_TO {
            confidence: 0.91
        }]->(b),

        (b)-[:RELATED_TO {
            confidence: 0.87
        }]->(c),

        (c)-[:RELATED_TO {
            confidence: 0.83
        }]->(d),

        (a)-[:ASSOCIATED_WITH {
            confidence: 0.79
        }]->(c),

        (e1:EvidenceNode {
            actor_a: "actor_001",
            actor_b: "actor_002",
            signal_type: "shared_username",
            field: "username",
            strength: 0.91,
            explanation: "Shared identity pattern detected",
            shared_entities: ["shadowfox"]
        }),

        (e2:EvidenceNode {
            actor_a: "actor_002",
            actor_b: "actor_003",
            signal_type: "shared_infrastructure",
            field: "infrastructure",
            strength: 0.87,
            explanation: "Common infrastructure indicator",
            shared_entities: ["infra_01"]
        }),

        (e3:EvidenceNode {
            actor_a: "actor_003",
            actor_b: "actor_004",
            signal_type: "behavioral_similarity",
            field: "behavior",
            strength: 0.83,
            explanation: "Similar behavioral activity detected",
            shared_entities: ["behavior_cluster_01"]
        }),

        (a)-[:SUPPORTED_BY]->(e1),
        (e1)-[:OBSERVED_BETWEEN]->(a),
        (e1)-[:OBSERVED_BETWEEN]->(b),

        (b)-[:SUPPORTED_BY]->(e2),
        (e2)-[:OBSERVED_BETWEEN]->(b),
        (e2)-[:OBSERVED_BETWEEN]->(c),

        (c)-[:SUPPORTED_BY]->(e3),
        (e3)-[:OBSERVED_BETWEEN]->(c),
        (e3)-[:OBSERVED_BETWEEN]->(d)

        RETURN count(*) AS created
        """

        result = session.run(query)
        record = result.single()

        return {
            "status": "demo_graph_seeded",
            "created": record["created"] if record else 0
        }

    except Exception as exc:

        return {
            "status": "seed_failed",
            "error": str(exc)
        }

    finally:

        if session is not None:
            session.close()

        if cloud_driver is not None:
            cloud_driver.close()
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

    This endpoint is additive to the existing graph API. It creates
    MULTI_ACTOR_RELATION edges because /graph/intelligence reads that
    relationship type. It also creates EvidenceNode records and links
    them to the corresponding actors.

    Synthetic investigation data only.
    """

    from app.graph.evidence_graph_service import _get_neo4j_session

    cloud_driver = None
    session = None

    query = """
    MATCH (n)
    WHERE n:Persona
       OR n:EvidenceNode
       OR n:RelationshipAssessment
    DETACH DELETE n

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
    })

    CREATE
    (a)-[:MULTI_ACTOR_RELATION {
        confidence: 0.91,
        relationship_type: "shared_identity",
        evidence_types: ["shared_username"],
        shared_entities: ["shadowfox"],
        evidence_explanations: ["Shared identity pattern detected"]
    }]->(b),

    (b)-[:MULTI_ACTOR_RELATION {
        confidence: 0.87,
        relationship_type: "shared_infrastructure",
        evidence_types: ["shared_infrastructure"],
        shared_entities: ["infra_01"],
        evidence_explanations: ["Common infrastructure indicator"]
    }]->(c),

    (c)-[:MULTI_ACTOR_RELATION {
        confidence: 0.83,
        relationship_type: "behavioral_similarity",
        evidence_types: ["behavioral_similarity"],
        shared_entities: ["behavior_cluster_01"],
        evidence_explanations: ["Similar behavioral activity detected"]
    }]->(d),

    (a)-[:MULTI_ACTOR_RELATION {
        confidence: 0.79,
        relationship_type: "shared_campaign",
        evidence_types: ["campaign_overlap"],
        shared_entities: ["campaign_alpha"],
        evidence_explanations: ["Campaign activity overlap detected"]
    }]->(c)

    CREATE
    (e1:EvidenceNode {
        actor_a: "actor_001",
        actor_b: "actor_002",
        signal_type: "shared_username",
        field: "username",
        strength: 0.91,
        explanation: "Shared identity pattern detected",
        shared_entities: ["shadowfox"],
        entity_key: "shadowfox"
    }),
    (e2:EvidenceNode {
        actor_a: "actor_002",
        actor_b: "actor_003",
        signal_type: "shared_infrastructure",
        field: "infrastructure",
        strength: 0.87,
        explanation: "Common infrastructure indicator",
        shared_entities: ["infra_01"],
        entity_key: "infra_01"
    }),
    (e3:EvidenceNode {
        actor_a: "actor_003",
        actor_b: "actor_004",
        signal_type: "behavioral_similarity",
        field: "behavior",
        strength: 0.83,
        explanation: "Similar behavioral activity detected",
        shared_entities: ["behavior_cluster_01"],
        entity_key: "behavior_cluster_01"
    }),
    (e4:EvidenceNode {
        actor_a: "actor_001",
        actor_b: "actor_003",
        signal_type: "campaign_overlap",
        field: "campaign",
        strength: 0.79,
        explanation: "Campaign activity overlap detected",
        shared_entities: ["campaign_alpha"],
        entity_key: "campaign_alpha"
    })

    CREATE
    (a)-[:SUPPORTED_BY]->(e1),
    (e1)-[:OBSERVED_BETWEEN]->(a),
    (e1)-[:OBSERVED_BETWEEN]->(b),

    (b)-[:SUPPORTED_BY]->(e2),
    (e2)-[:OBSERVED_BETWEEN]->(b),
    (e2)-[:OBSERVED_BETWEEN]->(c),

    (c)-[:SUPPORTED_BY]->(e3),
    (e3)-[:OBSERVED_BETWEEN]->(c),
    (e3)-[:OBSERVED_BETWEEN]->(d),

    (a)-[:SUPPORTED_BY]->(e4),
    (e4)-[:OBSERVED_BETWEEN]->(a),
    (e4)-[:OBSERVED_BETWEEN]->(c)

    RETURN
        count(DISTINCT a) +
        count(DISTINCT b) +
        count(DISTINCT c) +
        count(DISTINCT d) AS actor_count,
        count(DISTINCT e1) +
        count(DISTINCT e2) +
        count(DISTINCT e3) +
        count(DISTINCT e4) AS evidence_count
    """

    try:
        cloud_driver, session = _get_neo4j_session()

        result = session.run(query)
        record = result.single()

        return {
            "status": "demo_graph_seeded",
            "message": "DARKTRACE-X demo intelligence graph created successfully.",
            "actors_created": record["actor_count"] if record else 0,
            "evidence_created": record["evidence_count"] if record else 0,
            "relationships_created": 4,
        }

    except Exception as exc:
        return {
            "status": "seed_failed",
            "message": str(exc),
        }

    finally:
        if session is not None:
            session.close()

        if cloud_driver is not None:
            cloud_driver.close()


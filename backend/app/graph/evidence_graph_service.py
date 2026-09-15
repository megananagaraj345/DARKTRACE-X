import os

from neo4j import GraphDatabase
from neo4j.exceptions import Neo4jError, ServiceUnavailable, AuthError

from app.neo4j_client import driver


def _get_neo4j_session():
    """
    Creates a Neo4j session using deployment environment variables.

    Local development falls back to the existing shared driver.
    Render/cloud deployment uses NEO4J_URI, NEO4J_USERNAME,
    NEO4J_PASSWORD and NEO4J_DATABASE.
    """

    neo4j_uri = os.getenv("NEO4J_URI")
    neo4j_username = os.getenv("NEO4J_USERNAME")
    neo4j_password = os.getenv("NEO4J_PASSWORD")
    neo4j_database = os.getenv("NEO4J_DATABASE")

    # If cloud Neo4j configuration exists, create a deployment driver.
    if (
        neo4j_uri
        and neo4j_username
        and neo4j_password
    ):
        cloud_driver = GraphDatabase.driver(
            neo4j_uri,
            auth=(
                neo4j_username,
                neo4j_password,
            ),
        )

        if neo4j_database:
            return cloud_driver, cloud_driver.session(
                database=neo4j_database
            )

        return cloud_driver, cloud_driver.session()

    # Local development.
    return None, driver.session()


def create_evidence_graph(
    actor_a: str,
    actor_b: str,
    evidence: list[dict],
    confidence: float,
    relationship_type: str
):
    """
    Creates an explainable evidence graph in Neo4j.

    Synthetic investigation data only.

    Graph structure:

        Actor
          |
          | ASSESSED_WITH
          v
        RelationshipAssessment
          |
          | SUPPORTED_BY
          v
        EvidenceNode
          |
          | OBSERVED_BETWEEN
          v
        Actor
    """

    query = """
    MERGE (a:Persona {id: $actor_a})
    MERGE (b:Persona {id: $actor_b})

    MERGE (rel:RelationshipAssessment {
        actor_a: $actor_a,
        actor_b: $actor_b
    })

    SET rel.confidence = $confidence,
        rel.relationship_type = $relationship_type

    MERGE (a)-[:ASSESSED_WITH]->(rel)
    MERGE (rel)-[:ASSESSED_WITH]->(b)

    WITH a, b, rel

    UNWIND $evidence AS item

    MERGE (e:EvidenceNode {
        actor_a: $actor_a,
        actor_b: $actor_b,
        signal_type: item.signal_type,
        entity_key: item.entity_key
    })

    SET e.field = item.field,
        e.strength = item.strength,
        e.explanation = item.explanation,
        e.shared_entities = item.shared_entities

    MERGE (rel)-[:SUPPORTED_BY]->(e)
    MERGE (e)-[:OBSERVED_BETWEEN]->(a)
    MERGE (e)-[:OBSERVED_BETWEEN]->(b)

    RETURN count(e) AS evidence_count
    """

    normalized_evidence = []

    for index, item in enumerate(evidence):

        signal_type = str(
            item.get(
                "signal_type",
                "unknown"
            )
        )

        shared_entities = item.get(
            "shared_entities",
            []
        )

        if not isinstance(
            shared_entities,
            list
        ):
            shared_entities = [
                str(shared_entities)
            ]

        entity_key = (
            "|".join(
                str(entity)
                for entity in shared_entities
            )
            or f"evidence_{index}"
        )

        normalized_evidence.append({
            "signal_type": signal_type,
            "field": str(
                item.get(
                    "field",
                    ""
                )
            ),
            "strength": float(
                item.get(
                    "strength",
                    0.0
                )
            ),
            "explanation": str(
                item.get(
                    "explanation",
                    "Evidence observed"
                )
            ),
            "shared_entities": [
                str(entity)
                for entity in shared_entities
            ],
            "entity_key": entity_key
        })

    cloud_driver = None
    session = None

    try:

        cloud_driver, session = _get_neo4j_session()

        result = session.run(
            query,
            actor_a=actor_a,
            actor_b=actor_b,
            confidence=float(confidence),
            relationship_type=relationship_type,
            evidence=normalized_evidence
        )

        record = result.single()

        if not record:
            return {
                "evidence_count": 0
            }

        return {
            "evidence_count": record[
                "evidence_count"
            ]
        }

    except (
        ServiceUnavailable,
        AuthError,
        Neo4jError
    ) as exc:

        return {
            "evidence_count": 0,
            "status": "neo4j_unavailable",
            "message": (
                "Neo4j connection is unavailable. "
                "Check the deployment Neo4j environment configuration."
            ),
            "error_type": type(exc).__name__
        }

    finally:

        if session is not None:
            session.close()

        if cloud_driver is not None:
            cloud_driver.close()


def get_evidence_graph():
    """
    Retrieves the complete explainable evidence graph.

    If Neo4j is temporarily unavailable, the API returns a valid
    empty graph response instead of crashing with HTTP 500.
    """

    node_query = """
    MATCH (n)
    WHERE n:Persona
       OR n:EvidenceNode
       OR n:RelationshipAssessment

    RETURN
        elementId(n) AS node_id,
        labels(n) AS labels,
        properties(n) AS properties
    """

    relationship_query = """
    MATCH (a)-[r]->(b)
    WHERE
        (a:Persona OR a:EvidenceNode OR a:RelationshipAssessment)
        AND
        (b:Persona OR b:EvidenceNode OR b:RelationshipAssessment)

    RETURN
        elementId(a) AS source,
        elementId(b) AS target,
        type(r) AS relationship,
        properties(r) AS properties
    """

    cloud_driver = None
    session = None

    try:

        cloud_driver, session = _get_neo4j_session()

        node_result = session.run(
            node_query
        )

        nodes = []

        for record in node_result:

            properties = dict(
                record["properties"]
            )

            labels = list(
                record["labels"]
            )

            node_type = "unknown"

            if "Persona" in labels:
                node_type = "actor"

            elif "EvidenceNode" in labels:
                node_type = "evidence"

            elif "RelationshipAssessment" in labels:
                node_type = "relationship_assessment"

            nodes.append({
                "id": record["node_id"],
                "type": node_type,
                "labels": labels,
                "properties": properties
            })

        relationship_result = session.run(
            relationship_query
        )

        relationships = []

        for record in relationship_result:

            relationships.append({
                "source": record["source"],
                "target": record["target"],
                "relationship": record["relationship"],
                "properties": dict(
                    record["properties"]
                )
            })

        return {
            "nodes": nodes,
            "relationships": relationships,
            "statistics": {
                "node_count": len(nodes),
                "relationship_count": len(
                    relationships
                ),
                "actor_nodes": sum(
                    1
                    for node in nodes
                    if node["type"] == "actor"
                ),
                "evidence_nodes": sum(
                    1
                    for node in nodes
                    if node["type"] == "evidence"
                ),
                "assessment_nodes": sum(
                    1
                    for node in nodes
                    if node["type"]
                    == "relationship_assessment"
                )
            },
            "status": "connected"
        }

    except (
        ServiceUnavailable,
        AuthError,
        Neo4jError
    ) as exc:

        # IMPORTANT:
        # Do not allow a Neo4j outage to turn the entire
        # DARKTRACE-X API into an HTTP 500 failure.

        return {
            "nodes": [],
            "relationships": [],
            "statistics": {
                "node_count": 0,
                "relationship_count": 0,
                "actor_nodes": 0,
                "evidence_nodes": 0,
                "assessment_nodes": 0
            },
            "status": "neo4j_unavailable",
            "message": (
                "Neo4j connection is unavailable. "
                "DARKTRACE-X backend is running, but the "
                "graph database could not be reached."
            ),
            "error_type": type(exc).__name__
        }

    finally:

        if session is not None:
            session.close()

        if cloud_driver is not None:
            cloud_driver.close()
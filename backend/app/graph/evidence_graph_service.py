from app.neo4j_client import driver


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
          | SUPPORTED_BY
          v
        Evidence
          |
          | INDICATES
          v
        Relationship
          |
          | CONNECTS
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

    with driver.session() as session:

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


def get_evidence_graph():
    """
    Retrieves the complete explainable evidence graph.
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

    with driver.session() as session:

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
        }
    }
import os

from app.neo4j_client import driver


NEO4J_DATABASE = os.getenv(
    "NEO4J_DATABASE",
    "neo4j",
)


def _get_session():
    """
    Create a Neo4j session using the explicitly configured database.

    This is important for Neo4j Aura because the application should
    never rely on the driver's default database when a specific
    NEO4J_DATABASE value has been configured.
    """
    return driver.session(
        database=NEO4J_DATABASE
    )


def create_persona_node(
    persona_id: str,
    platform: str = "synthetic",
    username: str = "",
):
    query = """
    MERGE (p:Persona {id: $persona_id})

    SET p.platform = $platform,
        p.username = $username

    RETURN p
    """

    with _get_session() as session:
        result = session.run(
            query,
            persona_id=persona_id,
            platform=platform,
            username=username,
        )

        return result.single()


def create_relationship_edge(
    persona_a: str,
    persona_b: str,
    confidence: float,
    status: str,
    evidence: list[str] | None = None,
):
    if evidence is None:
        evidence = []

    query = """
    MERGE (a:Persona {id: $persona_a})
    MERGE (b:Persona {id: $persona_b})

    MERGE (a)-[r:RELATED_TO]->(b)

    SET r.confidence = $confidence,
        r.status = $status,
        r.evidence = $evidence

    RETURN a, r, b
    """

    with _get_session() as session:
        result = session.run(
            query,
            persona_a=persona_a,
            persona_b=persona_b,
            confidence=confidence,
            status=status,
            evidence=evidence,
        )

        return result.single()


def create_multi_actor_relationship(
    actor_a: str,
    actor_b: str,
    confidence: float,
    relationship_type: str,
    evidence: list[dict] | None = None,
):
    """
    Creates or updates a multi-actor intelligence relationship.

    The relationship represents an intelligence assessment
    based on correlated synthetic evidence.

    It does not establish confirmed real-world attribution.
    """

    if evidence is None:
        evidence = []

    evidence_types = [
        str(
            item.get(
                "signal_type",
                "unknown",
            )
        )
        for item in evidence
    ]

    shared_entities = []

    for item in evidence:
        entities = item.get(
            "shared_entities",
            [],
        )

        for entity in entities:
            if entity not in shared_entities:
                shared_entities.append(entity)

    evidence_explanations = [
        str(
            item.get(
                "explanation",
                "Evidence observed",
            )
        )
        for item in evidence
    ]

    query = """
    MERGE (a:Persona {id: $actor_a})
    MERGE (b:Persona {id: $actor_b})

    SET a.platform = coalesce(a.platform, "synthetic"),
        b.platform = coalesce(b.platform, "synthetic")

    MERGE (a)-[r:MULTI_ACTOR_RELATION]->(b)

    SET r.confidence = $confidence,
        r.relationship_type = $relationship_type,
        r.evidence_types = $evidence_types,
        r.shared_entities = $shared_entities,
        r.evidence_explanations = $evidence_explanations

    RETURN
        a.id AS actor_a,
        b.id AS actor_b,
        r.confidence AS confidence,
        r.relationship_type AS relationship_type,
        r.evidence_types AS evidence_types,
        r.shared_entities AS shared_entities,
        r.evidence_explanations AS evidence_explanations
    """

    with _get_session() as session:
        result = session.run(
            query,
            actor_a=actor_a,
            actor_b=actor_b,
            confidence=confidence,
            relationship_type=relationship_type,
            evidence_types=evidence_types,
            shared_entities=shared_entities,
            evidence_explanations=evidence_explanations,
        )

        record = result.single()

        if not record:
            return None

        return {
            "actor_a": record["actor_a"],
            "actor_b": record["actor_b"],
            "confidence": record["confidence"],
            "relationship_type": record[
                "relationship_type"
            ],
            "evidence_types": record[
                "evidence_types"
            ] or [],
            "shared_entities": record[
                "shared_entities"
            ] or [],
            "evidence_explanations": record[
                "evidence_explanations"
            ] or [],
        }


def get_persona_graph():
    query = """
    MATCH (a:Persona)-[r:RELATED_TO]->(b)

    RETURN
        a.id AS persona_a,
        b.id AS persona_b,
        r.confidence AS confidence,
        r.status AS status,
        r.evidence AS evidence
    """

    with _get_session() as session:
        result = session.run(query)

        return [
            {
                "persona_a": record["persona_a"],
                "persona_b": record["persona_b"],
                "confidence": record["confidence"],
                "status": record["status"],
                "evidence": record["evidence"] or [],
            }
            for record in result
        ]


def get_multi_actor_graph():
    """
    Returns all multi-actor intelligence relationships
    stored in Neo4j.
    """

    query = """
    MATCH (a:Persona)-[r:MULTI_ACTOR_RELATION]->(b)

    RETURN
        a.id AS actor_a,
        b.id AS actor_b,
        r.confidence AS confidence,
        r.relationship_type AS relationship_type,
        r.evidence_types AS evidence_types,
        r.shared_entities AS shared_entities,
        r.evidence_explanations AS evidence_explanations
    """

    with _get_session() as session:
        result = session.run(query)

        return [
            {
                "actor_a": record["actor_a"],
                "actor_b": record["actor_b"],
                "confidence": record["confidence"],
                "relationship_type": record[
                    "relationship_type"
                ],
                "evidence_types": record[
                    "evidence_types"
                ] or [],
                "shared_entities": record[
                    "shared_entities"
                ] or [],
                "evidence_explanations": record[
                    "evidence_explanations"
                ] or [],
            }
            for record in result
        ]


def get_intelligence_graph():
    """
    Returns a unified intelligence graph for the analyst layer.

    The graph contains:
    - Persona nodes
    - Multi-actor relationships
    - Relationship evidence
    - Derived statistics

    Data is limited to the synthetic investigation environment.
    """

    node_query = """
    MATCH (p:Persona)

    RETURN
        p.id AS id,
        p.platform AS platform,
        p.username AS username
    """

    relationship_query = """
    MATCH (a:Persona)-[r:MULTI_ACTOR_RELATION]->(b)

    RETURN
        a.id AS source,
        b.id AS target,
        type(r) AS relationship,
        r.confidence AS confidence,
        r.relationship_type AS relationship_type,
        r.evidence_types AS evidence_types,
        r.shared_entities AS shared_entities,
        r.evidence_explanations AS evidence_explanations
    """

    with _get_session() as session:

        node_result = session.run(
            node_query
        )

        nodes = []

        for record in node_result:
            nodes.append(
                {
                    "id": record["id"],
                    "type": "actor",
                    "platform": record["platform"]
                    or "synthetic",
                    "username": record["username"]
                    or "",
                }
            )

        relationship_result = session.run(
            relationship_query
        )

        relationships = []

        for record in relationship_result:
            relationships.append(
                {
                    "source": record["source"],
                    "target": record["target"],
                    "relationship": record[
                        "relationship"
                    ],
                    "confidence": record[
                        "confidence"
                    ],
                    "relationship_type": record[
                        "relationship_type"
                    ],
                    "evidence_types": record[
                        "evidence_types"
                    ] or [],
                    "shared_entities": record[
                        "shared_entities"
                    ] or [],
                    "evidence_explanations": record[
                        "evidence_explanations"
                    ] or [],
                }
            )

    actor_ids = {
        node["id"]
        for node in nodes
    }

    relationship_count = len(
        relationships
    )

    high_confidence_relationships = sum(
        1
        for relationship in relationships
        if float(
            relationship.get(
                "confidence",
                0.0,
            )
        ) >= 0.80
    )

    evidence_type_set = set()

    for relationship in relationships:
        for evidence_type in relationship.get(
            "evidence_types",
            [],
        ):
            evidence_type_set.add(
                str(evidence_type)
            )

    return {
        "nodes": nodes,
        "relationships": relationships,
        "statistics": {
            "actors": len(actor_ids),
            "nodes": len(nodes),
            "relationships": relationship_count,
            "high_confidence_relationships": (
                high_confidence_relationships
            ),
            "evidence_categories": len(
                evidence_type_set
            ),
            "evidence_types": sorted(
                evidence_type_set
            ),
        },
    }
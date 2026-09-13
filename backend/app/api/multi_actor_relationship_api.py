from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.pipeline.multi_actor_relationship_engine import (
    discover_multi_actor_relationships
)

from app.graph.graph_service import (
    create_multi_actor_relationship,
    get_multi_actor_graph
)


router = APIRouter(
    prefix="/multi-actor",
    tags=["Multi-Actor Relationship Discovery"]
)


class ActorProfile(BaseModel):
    actor_id: str

    aliases: str | None = None

    platforms: str | None = None

    writing_style: str | None = None

    activity_pattern: str | None = None

    infrastructure: str | None = None

    wallets: str | None = None

    campaigns: str | None = None


class MultiActorRelationshipRequest(BaseModel):
    actors: list[ActorProfile] = Field(
        min_length=2
    )


@router.post("/discover")
def discover_relationships(
    request: MultiActorRelationshipRequest
):

    actors = [
        actor.model_dump()
        for actor in request.actors
    ]

    result = discover_multi_actor_relationships(
        actors=actors
    )

    graph_sync_results = []

    for relationship in result["relationships"]:

        graph_result = create_multi_actor_relationship(
            actor_a=relationship["actor_a"],
            actor_b=relationship["actor_b"],
            confidence=relationship["confidence"],
            relationship_type=relationship[
                "relationship_type"
            ],
            evidence=relationship["evidence"]
        )

        if graph_result:

            graph_sync_results.append(
                graph_result
            )

    return {
        "status": (
            "multi_actor_relationship_analysis_completed"
        ),
        "actor_count": result["actor_count"],
        "relationship_count": result[
            "relationship_count"
        ],
        "relationships": result[
            "relationships"
        ],
        "neo4j_synced_count": len(
            graph_sync_results
        ),
        "neo4j_sync": graph_sync_results
    }


@router.get("/graph")
def get_multi_actor_graph_data():

    graph = get_multi_actor_graph()

    return {
        "status": "multi_actor_graph_retrieved",
        "relationship_count": len(graph),
        "relationships": graph
    }
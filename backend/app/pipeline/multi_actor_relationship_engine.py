from typing import Any, Dict, List, Set


RELATIONSHIP_SIGNAL_WEIGHTS = {
    "shared_alias": 0.95,
    "shared_infrastructure": 0.90,
    "shared_wallet": 0.88,
    "shared_campaign": 0.90,
    "shared_behavior": 0.80,
    "shared_temporal_pattern": 0.72,
    "shared_image": 0.70,
    "shared_stylometry": 0.82,
}


def clamp(
    value: float,
    minimum: float = 0.0,
    maximum: float = 1.0
) -> float:
    return max(
        minimum,
        min(maximum, float(value))
    )


def normalize_items(value: Any) -> Set[str]:
    """
    Convert strings/lists into a normalized set of entities.
    """

    if value is None:
        return set()

    if isinstance(value, list):
        return {
            str(item).strip().lower()
            for item in value
            if str(item).strip()
        }

    text = str(value).strip()

    if not text:
        return set()

    separators = [",", "|", "\n"]

    for separator in separators:
        if separator in text:
            return {
                item.strip().lower()
                for item in text.split(separator)
                if item.strip()
            }

    return {text.lower()}


def calculate_overlap(
    actor_a: Dict[str, Any],
    actor_b: Dict[str, Any],
    field: str
) -> Dict[str, Any]:

    items_a = normalize_items(
        actor_a.get(field)
    )

    items_b = normalize_items(
        actor_b.get(field)
    )

    shared = sorted(
        items_a.intersection(items_b)
    )

    return {
        "field": field,
        "shared": shared,
        "shared_count": len(shared),
        "changed": bool(shared)
    }


def build_relationship_evidence(
    actor_a: Dict[str, Any],
    actor_b: Dict[str, Any]
) -> List[Dict[str, Any]]:

    evidence = []

    field_mapping = {
        "aliases": "shared_alias",
        "infrastructure": "shared_infrastructure",
        "wallets": "shared_wallet",
        "campaigns": "shared_campaign",
        "writing_style": "shared_stylometry",
        "activity_pattern": "shared_temporal_pattern",
    }

    for field, signal_type in field_mapping.items():

        overlap = calculate_overlap(
            actor_a=actor_a,
            actor_b=actor_b,
            field=field
        )

        if overlap["shared"]:

            evidence.append({
                "signal_type": signal_type,
                "field": field,
                "shared_entities": overlap["shared"],
                "strength": RELATIONSHIP_SIGNAL_WEIGHTS[
                    signal_type
                ],
                "explanation": (
                    f"Actors share {field}: "
                    f"{', '.join(overlap['shared'])}"
                )
            })

    return evidence


def calculate_relationship_confidence(
    evidence: List[Dict[str, Any]]
) -> float:

    if not evidence:
        return 0.0

    weighted_scores = [
        float(item["strength"])
        for item in evidence
    ]

    # Independent evidence should increase confidence,
    # but the score must remain bounded between 0 and 1.
    base_score = sum(
        weighted_scores
    ) / len(weighted_scores)

    diversity_bonus = min(
        0.20,
        max(
            0,
            len(evidence) - 1
        ) * 0.05
    )

    confidence = base_score + diversity_bonus

    return round(
        clamp(confidence),
        4
    )


def determine_relationship_type(
    evidence: List[Dict[str, Any]],
    confidence: float
) -> str:

    if not evidence:
        return "no_relationship_detected"

    signal_types = {
        item["signal_type"]
        for item in evidence
    }

    if (
        "shared_infrastructure" in signal_types
        and "shared_campaign" in signal_types
    ):
        return "shared_campaign_infrastructure"

    if (
        "shared_wallet" in signal_types
        and "shared_infrastructure" in signal_types
    ):
        return "shared_wallet_infrastructure"

    if (
        "shared_alias" in signal_types
        and "shared_stylometry" in signal_types
    ):
        return "behavioral_alias_overlap"

    if len(signal_types) >= 3:
        return "multi_signal_relationship"

    if len(signal_types) == 2:
        return "dual_signal_relationship"

    return "single_signal_relationship"


def build_assessment(
    actor_a: Dict[str, Any],
    actor_b: Dict[str, Any],
    evidence: List[Dict[str, Any]],
    confidence: float,
    relationship_type: str
) -> str:

    if not evidence:

        return (
            f"No significant relationship was detected "
            f"between {actor_a.get('actor_id')} and "
            f"{actor_b.get('actor_id')}."
        )

    actor_a_id = actor_a.get(
        "actor_id",
        "actor_a"
    )

    actor_b_id = actor_b.get(
        "actor_id",
        "actor_b"
    )

    assessment = (
        f"DARKTRACE-X identified a potential relationship "
        f"between {actor_a_id} and {actor_b_id} with "
        f"{round(confidence * 100)}% confidence."
    )

    assessment += (
        f" Relationship type: {relationship_type}. "
        f"{len(evidence)} independent signal category(s) "
        f"support the assessment."
    )

    assessment += (
        " This is an intelligence assessment and should "
        "not be interpreted as confirmed attribution or "
        "proof that the actors are controlled by the same "
        "real-world person."
    )

    return assessment


def compare_two_actors(
    actor_a: Dict[str, Any],
    actor_b: Dict[str, Any]
) -> Dict[str, Any]:

    evidence = build_relationship_evidence(
        actor_a=actor_a,
        actor_b=actor_b
    )

    confidence = calculate_relationship_confidence(
        evidence=evidence
    )

    relationship_type = determine_relationship_type(
        evidence=evidence,
        confidence=confidence
    )

    assessment = build_assessment(
        actor_a=actor_a,
        actor_b=actor_b,
        evidence=evidence,
        confidence=confidence,
        relationship_type=relationship_type
    )

    return {
        "actor_a": actor_a.get("actor_id"),
        "actor_b": actor_b.get("actor_id"),
        "relationship_detected": bool(evidence),
        "relationship_type": relationship_type,
        "confidence": confidence,
        "evidence_count": len(evidence),
        "evidence": evidence,
        "assessment": assessment
    }


def discover_multi_actor_relationships(
    actors: List[Dict[str, Any]]
) -> Dict[str, Any]:

    relationships = []

    for index, actor_a in enumerate(actors):

        for actor_b in actors[index + 1:]:

            result = compare_two_actors(
                actor_a=actor_a,
                actor_b=actor_b
            )

            if result["relationship_detected"]:

                relationships.append(
                    result
                )

    return {
        "actor_count": len(actors),
        "relationship_count": len(
            relationships
        ),
        "relationships": relationships
    }
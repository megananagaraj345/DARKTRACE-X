from typing import Any, Dict, List


CAMPAIGN_SIGNAL_TYPES = {
    "targeting",
    "access_seeking",
    "preparation",
    "operational_activity",
    "impact",
    "monetization",
    "migration",
    "evasion",
    "infrastructure",
    "wallet",
    "blockchain",
    "alias",
    "stylometry",
    "temporal",
    "image",
    "campaign"
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


def normalize_signal(signal: Dict[str, Any]) -> Dict[str, Any]:
    signal_type = str(
        signal.get("type", "")
    ).strip().lower()

    confidence = clamp(
        signal.get("confidence", 0.0)
    )

    description = signal.get(
        "description",
        signal_type or "Unknown signal"
    )

    source = signal.get(
        "source",
        "campaign_detection_engine"
    )

    related_entity = signal.get(
        "related_entity"
    )

    return {
        "type": signal_type,
        "confidence": confidence,
        "description": description,
        "source": source,
        "related_entity": related_entity
    }


def filter_campaign_signals(
    signals: List[Dict[str, Any]]
) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:

    valid_signals = []
    ignored_signals = []

    for signal in signals:

        normalized = normalize_signal(signal)

        if normalized["type"] in CAMPAIGN_SIGNAL_TYPES:
            valid_signals.append(normalized)
        else:
            ignored_signals.append(normalized)

    return valid_signals, ignored_signals


def calculate_signal_strength(
    signals: List[Dict[str, Any]]
) -> float:

    if not signals:
        return 0.0

    total = sum(
        signal["confidence"]
        for signal in signals
    )

    return clamp(
        total / len(signals)
    )


def calculate_diversity_score(
    signals: List[Dict[str, Any]]
) -> float:

    if not signals:
        return 0.0

    unique_types = len(
        set(
            signal["type"]
            for signal in signals
        )
    )

    return clamp(
        unique_types / 5.0
    )


def calculate_entity_score(
    signals: List[Dict[str, Any]]
) -> float:

    if not signals:
        return 0.0

    related_entities = [
        signal["related_entity"]
        for signal in signals
        if signal.get("related_entity")
    ]

    if not related_entities:
        return 0.0

    unique_entities = len(
        set(
            str(entity)
            for entity in related_entities
        )
    )

    return clamp(
        unique_entities / 3.0
    )


def calculate_campaign_confidence(
    signals: List[Dict[str, Any]]
) -> float:

    if not signals:
        return 0.0

    signal_strength = calculate_signal_strength(
        signals
    )

    diversity_score = calculate_diversity_score(
        signals
    )

    entity_score = calculate_entity_score(
        signals
    )

    confidence = (
        (signal_strength * 0.50)
        +
        (diversity_score * 0.30)
        +
        (entity_score * 0.20)
    )

    return round(
        clamp(confidence),
        4
    )


def determine_campaign_status(
    confidence: float,
    signal_count: int
) -> str:

    if signal_count < 2:
        return "insufficient_evidence"

    if confidence >= 0.80:
        return "high_confidence_emerging_campaign"

    if confidence >= 0.60:
        return "emerging_campaign"

    if confidence >= 0.40:
        return "possible_campaign"

    return "weak_campaign_indicator"


def generate_campaign_name(
    actor_id: str | None,
    signals: List[Dict[str, Any]]
) -> str:

    if actor_id:
        prefix = f"{actor_id} Emerging Campaign"
    else:
        prefix = "Emerging Synthetic Campaign"

    signal_types = sorted(
        set(
            signal["type"]
            for signal in signals
        )
    )

    if signal_types:
        primary_types = ", ".join(
            signal_types[:3]
        )

        return (
            f"{prefix} "
            f"({primary_types})"
        )

    return prefix


def build_supporting_evidence(
    signals: List[Dict[str, Any]]
) -> List[str]:

    evidence = []

    for signal in signals:

        evidence.append(
            f"{signal['type']} signal: "
            f"{signal['description']} "
            f"(confidence={round(signal['confidence'], 2)})"
        )

    return evidence


def build_related_entities(
    signals: List[Dict[str, Any]]
) -> List[str]:

    entities = []

    for signal in signals:

        entity = signal.get(
            "related_entity"
        )

        if entity:
            entities.append(
                str(entity)
            )

    return sorted(
        set(entities)
    )


def build_campaign_assessment(
    confidence: float,
    status: str,
    signals: List[Dict[str, Any]],
    related_entities: List[str]
) -> str:

    if status == "insufficient_evidence":

        return (
            "Insufficient correlated evidence "
            "to assess an emerging campaign."
        )

    assessment = (
        "DARKTRACE-X identified a correlated "
        "cluster of activity that may represent "
        f"an emerging campaign with "
        f"{round(confidence * 100)}% confidence."
    )

    assessment += (
        f" {len(signals)} relevant signal(s) "
        "contributed to this assessment."
    )

    if related_entities:

        assessment += (
            f" {len(related_entities)} related "
            "entity or infrastructure reference(s) "
            "were observed."
        )

    assessment += (
        " This is an intelligence assessment "
        "and should not be interpreted as "
        "confirmed attribution."
    )

    return assessment


def detect_emerging_campaign(
    actor_id: str | None,
    signals: List[Dict[str, Any]]
) -> Dict[str, Any]:

    valid_signals, ignored_signals = (
        filter_campaign_signals(
            signals
        )
    )

    confidence = calculate_campaign_confidence(
        valid_signals
    )

    status = determine_campaign_status(
        confidence=confidence,
        signal_count=len(valid_signals)
    )

    campaign_name = generate_campaign_name(
        actor_id=actor_id,
        signals=valid_signals
    )

    supporting_evidence = (
        build_supporting_evidence(
            valid_signals
        )
    )

    related_entities = (
        build_related_entities(
            valid_signals
        )
    )

    assessment = build_campaign_assessment(
        confidence=confidence,
        status=status,
        signals=valid_signals,
        related_entities=related_entities
    )

    return {
        "actor_id": actor_id,
        "campaign_name": campaign_name,
        "confidence": confidence,
        "status": status,
        "signal_count": len(valid_signals),
        "supporting_evidence": supporting_evidence,
        "related_entities": related_entities,
        "assessment": assessment,
        "ignored_signal_count": len(
            ignored_signals
        ),
        "ignored_signals": ignored_signals
    }
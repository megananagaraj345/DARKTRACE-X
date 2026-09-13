from typing import Any, Dict, List


SIGNAL_WEIGHTS = {
    "alias": 0.95,
    "stylometry": 0.82,
    "temporal": 0.72,
    "infrastructure": 0.90,
    "wallet": 0.88,
    "campaign": 0.90,
    "image": 0.70,
}


def clamp(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _items(value: Any) -> set[str]:
    if value is None:
        return set()
    if isinstance(value, (list, tuple, set)):
        return {str(x).strip().lower() for x in value if str(x).strip()}
    return {
        x.strip().lower()
        for x in str(value).replace("|", ",").split(",")
        if x.strip()
    }


def _overlap(a: Any, b: Any) -> List[str]:
    return sorted(_items(a) & _items(b))


def resolve_actor_pair(
    actor_a: Dict[str, Any],
    actor_b: Dict[str, Any],
    computed_signals: Dict[str, float] | None = None,
) -> Dict[str, Any]:
    computed_signals = computed_signals or {}
    evidence = []

    for field, signal_type in [
        ("aliases", "alias"),
        ("infrastructure", "infrastructure"),
        ("wallets", "wallet"),
        ("campaigns", "campaign"),
        ("images", "image"),
    ]:
        shared = _overlap(actor_a.get(field), actor_b.get(field))
        if shared:
            evidence.append({
                "signal_type": signal_type,
                "strength": SIGNAL_WEIGHTS[signal_type],
                "shared_entities": shared,
                "explanation": f"Shared {field}: {', '.join(shared)}",
            })

    for signal_type in ("stylometry", "temporal"):
        if signal_type in computed_signals:
            value = clamp(computed_signals[signal_type])
            if value > 0:
                evidence.append({
                    "signal_type": signal_type,
                    "strength": value,
                    "shared_entities": [],
                    "explanation": f"Computed {signal_type} similarity: {value:.2f}",
                })

    if not evidence:
        confidence = 0.0
    else:
        base = sum(float(e["strength"]) for e in evidence) / len(evidence)
        diversity_bonus = min(0.20, max(0, len(evidence)-1) * 0.05)
        confidence = clamp(base + diversity_bonus)

    if confidence >= 0.80:
        classification = "high_confidence_correlation"
    elif confidence >= 0.60:
        classification = "probable_correlation"
    elif confidence >= 0.40:
        classification = "possible_correlation"
    else:
        classification = "weak_or_unresolved"

    return {
        "actor_a": actor_a.get("actor_id", "actor_a"),
        "actor_b": actor_b.get("actor_id", "actor_b"),
        "confidence": round(confidence, 4),
        "confidence_percent": round(confidence * 100, 1),
        "classification": classification,
        "evidence_count": len(evidence),
        "evidence": evidence,
        "assessment": (
            "Multiple independent signals support a potential actor relationship."
            if len(evidence) >= 2
            else "A limited correlation signal was observed."
            if evidence
            else "No meaningful correlation signal was observed."
        ),
        "disclaimer": (
            "Entity resolution produces an intelligence assessment, not confirmed "
            "real-world attribution."
        ),
    }

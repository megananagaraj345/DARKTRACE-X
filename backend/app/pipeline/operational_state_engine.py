from typing import List, Dict


# DARKTRACE-X operational state progression
OPERATIONAL_STATES = [
    "Reconnaissance",
    "Targeting",
    "Access Seeking",
    "Preparation",
    "Operational Activity",
    "Impact / Monetization",
    "Migration / Evasion"
]


def clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    """
    Keep a numeric value inside a safe range.
    """
    return max(minimum, min(maximum, float(value)))


def calculate_state_scores(signals: List[Dict]) -> Dict[str, float]:
    """
    Calculate evidence-based scores for each operational state.

    Each signal may contain:

        {
            "type": "reconnaissance",
            "confidence": 0.80
        }

    The engine uses synthetic/observed evidence and produces
    an intelligence assessment rather than a confirmed fact.
    """

    state_scores = {
        state: 0.0
        for state in OPERATIONAL_STATES
    }

    # Mapping between signal types and operational states.
    signal_mapping = {
        "reconnaissance": "Reconnaissance",
        "targeting": "Targeting",
        "access_seeking": "Access Seeking",
        "preparation": "Preparation",
        "operational_activity": "Operational Activity",
        "impact": "Impact / Monetization",
        "monetization": "Impact / Monetization",
        "migration": "Migration / Evasion",
        "evasion": "Migration / Evasion"
    }

    for signal in signals:
        signal_type = str(
            signal.get("type", "")
        ).strip().lower()

        confidence = clamp(
            signal.get("confidence", 0.0)
        )

        weight = max(
            0.0,
            float(signal.get("weight", 1.0))
        )

        state = signal_mapping.get(signal_type)

        if state:
            score = confidence * weight

            # Keep the strongest evidence for a state.
            state_scores[state] = max(
                state_scores[state],
                score
            )

    return {
        state: round(score, 4)
        for state, score in state_scores.items()
    }


def determine_current_state(
    state_scores: Dict[str, float]
) -> Dict[str, object]:
    """
    Determine the most strongly supported operational state.
    """

    if not state_scores:
        return {
            "current_state": "Unknown",
            "confidence": 0.0
        }

    current_state = max(
        state_scores,
        key=state_scores.get
    )

    confidence = clamp(
        state_scores[current_state]
    )

    # If there is no meaningful evidence,
    # do not force an operational state.
    if confidence <= 0.0:
        return {
            "current_state": "Unknown",
            "confidence": 0.0
        }

    return {
        "current_state": current_state,
        "confidence": round(confidence, 4)
    }


def build_supporting_evidence(
    signals: List[Dict],
    current_state: str
) -> List[str]:
    """
    Return evidence items supporting the selected state.
    """

    supporting = []

    for signal in signals:
        signal_type = str(
            signal.get("type", "")
        ).strip().lower()

        confidence = clamp(
            signal.get("confidence", 0.0)
        )

        description = signal.get(
            "description",
            signal_type
        )

        if confidence >= 0.5:
            supporting.append(
                f"{description} "
                f"(confidence={round(confidence, 2)})"
            )

    return supporting


def build_contradictory_evidence(
    signals: List[Dict],
    current_state: str
) -> List[str]:
    """
    Identify weaker signals that do not directly support
    the selected operational state.
    """

    contradictory = []

    for signal in signals:
        signal_type = str(
            signal.get("type", "")
        ).strip().lower()

        confidence = clamp(
            signal.get("confidence", 0.0)
        )

        description = signal.get(
            "description",
            signal_type
        )

        if confidence < 0.5:
            contradictory.append(
                f"Weak or contradictory signal: "
                f"{description} "
                f"(confidence={round(confidence, 2)})"
            )

    return contradictory


def build_assessment(
    current_state: str,
    confidence: float,
    supporting_evidence: List[str],
    contradictory_evidence: List[str]
) -> str:
    """
    Generate a human-readable intelligence assessment.
    """

    if current_state == "Unknown":
        return (
            "Insufficient evidence to determine the actor's "
            "current operational state."
        )

    assessment = (
        f"DARKTRACE-X assesses the actor as currently associated "
        f"with the '{current_state}' operational state with "
        f"{round(confidence * 100)}% confidence."
    )

    if supporting_evidence:
        assessment += (
            f" {len(supporting_evidence)} supporting "
            f"evidence item(s) were identified."
        )

    if contradictory_evidence:
        assessment += (
            f" {len(contradictory_evidence)} weak or "
            f"contradictory signal(s) should be considered."
        )

    assessment += (
        " This is an intelligence assessment and should not "
        "be interpreted as confirmed attribution."
    )

    return assessment


def reconstruct_operational_state(
    signals: List[Dict]
) -> Dict[str, object]:
    """
    Main DARKTRACE-X Operational State Reconstruction function.

    Input:
        A list of observed synthetic/analyst-approved signals.

    Output:
        Current state
        Confidence
        Supporting evidence
        Contradictory evidence
        Evidence count
        Assessment
    """

    state_scores = calculate_state_scores(
        signals
    )

    state_result = determine_current_state(
        state_scores
    )

    current_state = state_result["current_state"]
    confidence = state_result["confidence"]

    supporting_evidence = build_supporting_evidence(
        signals,
        current_state
    )

    contradictory_evidence = build_contradictory_evidence(
        signals,
        current_state
    )

    assessment = build_assessment(
        current_state=current_state,
        confidence=confidence,
        supporting_evidence=supporting_evidence,
        contradictory_evidence=contradictory_evidence
    )

    return {
        "current_state": current_state,
        "state_confidence": confidence,
        "state_scores": state_scores,
        "supporting_evidence": supporting_evidence,
        "contradictory_evidence": contradictory_evidence,
        "evidence_count": len(signals),
        "assessment": assessment
    }
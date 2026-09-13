from typing import Any, Dict, List


OPERATIONAL_STATES = [
    "Reconnaissance",
    "Targeting",
    "Access Seeking",
    "Preparation",
    "Operational Activity",
    "Impact / Monetization",
    "Migration / Evasion",
]


STATE_ORDER = {
    "Reconnaissance": 0,
    "Targeting": 1,
    "Access Seeking": 2,
    "Preparation": 3,
    "Operational Activity": 4,
    "Impact / Monetization": 5,
    "Migration / Evasion": 6,
}


NEXT_STATE_MAP = {
    "Reconnaissance": ["Targeting", "Access Seeking"],
    "Targeting": ["Access Seeking", "Preparation"],
    "Access Seeking": ["Preparation", "Operational Activity"],
    "Preparation": ["Operational Activity", "Migration / Evasion"],
    "Operational Activity": ["Impact / Monetization", "Migration / Evasion"],
    "Impact / Monetization": ["Migration / Evasion"],
    "Migration / Evasion": ["Reconnaissance", "Preparation"],
}


def clamp(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def normalize_state(state: Any) -> str:
    if not state:
        return "Unknown"

    text = str(state).strip().lower()

    for known_state in OPERATIONAL_STATES:
        if text == known_state.lower():
            return known_state

    aliases = {
        "recon": "Reconnaissance",
        "target": "Targeting",
        "access": "Access Seeking",
        "preparation": "Preparation",
        "operational": "Operational Activity",
        "impact": "Impact / Monetization",
        "monetization": "Impact / Monetization",
        "migration": "Migration / Evasion",
        "evasion": "Migration / Evasion",
    }

    return aliases.get(text, "Unknown")


def calculate_prediction(
    current_state: str,
    state_confidence: float = 0.0,
    risk_score: float = 0.0,
    signals: List[Dict[str, Any]] | None = None,
) -> Dict[str, Any]:

    signals = signals or []

    current_state = normalize_state(current_state)
    state_confidence = clamp(state_confidence)
    risk_score = max(0.0, min(100.0, float(risk_score)))

    candidates = NEXT_STATE_MAP.get(current_state, [])

    if not candidates:
        return {
            "predicted_state": "Unknown",
            "probability": 0.0,
            "candidate_predictions": [],
            "reasoning": ["Insufficient transition information for the current state."],
        }

    scored_candidates = []

    signal_types = {
        str(signal.get("type", "")).strip().lower()
        for signal in signals
    }

    signal_confidences = [
        clamp(float(signal.get("confidence", 0.0)))
        for signal in signals
    ]

    average_signal_confidence = (
        sum(signal_confidences) / len(signal_confidences)
        if signal_confidences
        else 0.0
    )

    for candidate in candidates:

        score = 0.35

        # Current state confidence contributes to prediction strength.
        score += state_confidence * 0.25

        # Higher risk increases forward-transition probability.
        score += (risk_score / 100.0) * 0.20

        # Independent observed signals strengthen the prediction.
        score += average_signal_confidence * 0.10

        # Specific signal patterns provide additional context.
        if candidate == "Targeting" and "targeting" in signal_types:
            score += 0.08

        if candidate == "Access Seeking" and (
            "access_seeking" in signal_types
            or "access" in signal_types
        ):
            score += 0.08

        if candidate == "Preparation" and "preparation" in signal_types:
            score += 0.08

        if candidate == "Operational Activity" and (
            "operational_activity" in signal_types
            or "operational" in signal_types
        ):
            score += 0.08

        if candidate == "Impact / Monetization" and (
            "impact" in signal_types
            or "monetization" in signal_types
        ):
            score += 0.08

        if candidate == "Migration / Evasion" and (
            "migration" in signal_types
            or "evasion" in signal_types
        ):
            score += 0.08

        scored_candidates.append(
            {
                "state": candidate,
                "probability": round(clamp(score), 4),
            }
        )

    scored_candidates.sort(
        key=lambda item: item["probability"],
        reverse=True
    )

    predicted = scored_candidates[0]

    reasoning = [
        f"Current operational state: {current_state}.",
        f"Current state confidence: {round(state_confidence * 100)}%.",
        f"Current risk score: {round(risk_score)} / 100.",
    ]

    if signals:
        reasoning.append(
            f"{len(signals)} observed signal(s) were considered."
        )

    if average_signal_confidence:
        reasoning.append(
            f"Average observed signal confidence: "
            f"{round(average_signal_confidence * 100)}%."
        )

    reasoning.append(
        f"The highest-scoring next state is {predicted['state']}."
    )

    reasoning.append(
        "This is a predictive intelligence assessment, "
        "not a confirmed future event."
    )

    return {
        "predicted_state": predicted["state"],
        "probability": predicted["probability"],
        "candidate_predictions": scored_candidates,
        "reasoning": reasoning,
    }


def build_prediction_assessment(
    actor_id: str,
    current_state: str,
    prediction: Dict[str, Any],
) -> str:

    probability = round(
        float(prediction.get("probability", 0.0)) * 100
    )

    predicted_state = prediction.get(
        "predicted_state",
        "Unknown"
    )

    return (
        f"DARKTRACE-X predicts that {actor_id} is most likely to "
        f"transition from '{current_state}' toward "
        f"'{predicted_state}' with an estimated probability of "
        f"{probability}%. This prediction is based on observed "
        f"behavioral, operational, and risk signals. It is an "
        f"intelligence forecast and should not be interpreted as "
        f"certainty about future activity."
    )


def predict_next_activity(
    actor_id: str,
    current_state: str,
    state_confidence: float = 0.0,
    risk_score: float = 0.0,
    signals: List[Dict[str, Any]] | None = None,
) -> Dict[str, Any]:

    normalized_state = normalize_state(current_state)

    prediction = calculate_prediction(
        current_state=normalized_state,
        state_confidence=state_confidence,
        risk_score=risk_score,
        signals=signals,
    )

    assessment = build_prediction_assessment(
        actor_id=actor_id,
        current_state=normalized_state,
        prediction=prediction,
    )

    return {
        "actor_id": actor_id,
        "current_state": normalized_state,
        "predicted_state": prediction["predicted_state"],
        "probability": prediction["probability"],
        "candidate_predictions": prediction["candidate_predictions"],
        "reasoning": prediction["reasoning"],
        "assessment": assessment,
    }
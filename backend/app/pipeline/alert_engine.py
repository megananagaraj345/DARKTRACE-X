from typing import Any, Dict, List


def clamp(value: float, minimum: float = 0.0, maximum: float = 1.0) -> float:
    return max(minimum, min(maximum, float(value)))


def calculate_severity(
    risk_score: float,
    prediction_probability: float,
    change_count: int,
    state_changed: bool,
) -> str:
    risk = max(0.0, min(100.0, float(risk_score)))
    prediction = clamp(prediction_probability)

    score = (
        (risk / 100.0) * 0.50
        + prediction * 0.30
        + min(change_count / 10.0, 1.0) * 0.10
        + (0.10 if state_changed else 0.0)
    )

    if score >= 0.80:
        return "CRITICAL"
    if score >= 0.65:
        return "HIGH"
    if score >= 0.45:
        return "MEDIUM"
    return "LOW"


def extract_changes(changes: List[Dict[str, Any]]) -> List[str]:
    reasons = []

    for change in changes:
        field = change.get("field", "unknown")

        if change.get("added"):
            for item in change["added"]:
                reasons.append(
                    f"New {field} detected: {item}"
                )

        if change.get("removed"):
            for item in change["removed"]:
                reasons.append(
                    f"{field} removed or no longer observed: {item}"
                )

        if field == "current_state" and change.get("changed"):
            reasons.append(
                f"Operational state changed from "
                f"'{change.get('old_value')}' to "
                f"'{change.get('new_value')}'"
            )

        if field == "confidence" and change.get("changed"):
            reasons.append(
                f"Actor confidence changed from "
                f"{change.get('old_value')} to "
                f"{change.get('new_value')}"
            )

        if field == "risk_score" and change.get("changed"):
            reasons.append(
                f"Risk score changed from "
                f"{change.get('old_value')} to "
                f"{change.get('new_value')}"
            )

    return reasons


def generate_defensive_recommendations(
    severity: str,
    predicted_state: str,
) -> List[str]:
    recommendations = [
        "Increase monitoring of newly observed indicators.",
        "Validate the supporting evidence before taking attribution-sensitive action.",
        "Preserve relevant observations and timestamps for analyst review.",
    ]

    if severity in {"HIGH", "CRITICAL"}:
        recommendations.extend([
            "Prioritize analyst review of the affected actor and campaign.",
            "Review defensive controls associated with the observed infrastructure.",
            "Prepare incident-response teams for the predicted operational transition.",
        ])

    if predicted_state == "Impact / Monetization":
        recommendations.append(
            "Review relevant defensive controls for potential impact or monetization activity."
        )

    if predicted_state == "Migration / Evasion":
        recommendations.append(
            "Increase visibility around newly appearing infrastructure and possible migration indicators."
        )

    return recommendations


def generate_intelligence_alert(
    actor_id: str,
    risk_score: float,
    current_state: str,
    predicted_state: str,
    prediction_probability: float,
    changes: List[Dict[str, Any]] | None = None,
) -> Dict[str, Any]:

    changes = changes or []

    change_reasons = extract_changes(changes)

    state_changed = any(
        change.get("field") == "current_state"
        and change.get("changed")
        for change in changes
    )

    severity = calculate_severity(
        risk_score=risk_score,
        prediction_probability=prediction_probability,
        change_count=len(changes),
        state_changed=state_changed,
    )

    recommendations = generate_defensive_recommendations(
        severity=severity,
        predicted_state=predicted_state,
    )

    reasons = list(change_reasons)

    reasons.append(
        f"Current operational state: {current_state}"
    )

    reasons.append(
        f"Predicted next state: {predicted_state} "
        f"({round(prediction_probability * 100)}% probability)"
    )

    reasons.append(
        f"Current risk score: {round(risk_score)} / 100"
    )

    title = (
        f"{severity} intelligence alert for {actor_id}"
    )

    assessment = (
        f"DARKTRACE-X generated a {severity} intelligence alert "
        f"for {actor_id}. The actor is currently assessed in the "
        f"'{current_state}' state and the predicted next state is "
        f"'{predicted_state}' with {round(prediction_probability * 100)}% "
        f"probability. This alert is based on correlated synthetic "
        f"intelligence signals and is intended to support defensive "
        f"analyst decision-making."
    )

    return {
        "alert_id": f"DTX-ALERT-{actor_id}",
        "actor_id": actor_id,
        "severity": severity,
        "title": title,
        "current_state": current_state,
        "predicted_state": predicted_state,
        "prediction_probability": round(
            prediction_probability, 4
        ),
        "risk_score": round(risk_score, 2),
        "change_count": len(changes),
        "reasons": reasons,
        "defensive_recommendations": recommendations,
        "assessment": assessment,
    }
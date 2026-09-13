from __future__ import annotations
from typing import Any, Dict, List

NEXT_STATE_MAP = {
    "Reconnaissance": ["Targeting", "Access Seeking"],
    "Targeting": ["Access Seeking", "Preparation"],
    "Access Seeking": ["Preparation", "Operational Activity"],
    "Preparation": ["Operational Activity", "Migration / Evasion"],
    "Operational Activity": ["Impact / Monetization", "Migration / Evasion"],
    "Impact / Monetization": ["Migration / Evasion", "Operational Activity"],
    "Migration / Evasion": ["Reconnaissance", "Targeting"],
}

STATE_BASE = {
    "Reconnaissance": 0.56,
    "Targeting": 0.62,
    "Access Seeking": 0.68,
    "Preparation": 0.74,
    "Operational Activity": 0.80,
    "Impact / Monetization": 0.84,
    "Migration / Evasion": 0.70,
}


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return round(max(low, min(high, value)), 4)


def what_if_forecast(current_state: str, risk_score: float, state_confidence: float,
                     campaign_confidence: float = 0.0, change_count: int = 0) -> Dict[str, Any]:
    next_states = NEXT_STATE_MAP.get(current_state, ["Reconnaissance", "Targeting"])
    pressure = (float(risk_score) / 100.0) * 0.40 + float(state_confidence) * 0.25 + float(campaign_confidence) * 0.20 + min(change_count, 10) / 10.0 * 0.15
    scenarios: List[Dict[str, Any]] = []
    for idx, state in enumerate(next_states):
        base = STATE_BASE.get(state, 0.65)
        probability = clamp(0.45 * base + 0.35 * pressure + (0.08 if idx == 0 else 0.0) + 0.12 * float(state_confidence))
        reasoning = {
            "Operational Activity": "High-risk actors with preparation evidence may transition into active execution.",
            "Impact / Monetization": "Sustained operational activity increases the likelihood of monetization or impact behavior.",
            "Migration / Evasion": "Elevated pressure and new changes can trigger infrastructure or identity migration.",
            "Preparation": "Accumulating targeting and infrastructure evidence is consistent with preparation.",
            "Access Seeking": "Targeting signals can precede attempts to obtain access.",
            "Targeting": "New entities and campaign clustering can indicate narrowing target selection.",
            "Reconnaissance": "A migration or reset can restart information-gathering behavior.",
        }.get(state, "Scenario is derived from the actor's current operational state and fused evidence.")
        scenarios.append({"state": state, "probability": probability, "reasoning": reasoning})
    total = sum(s["probability"] for s in scenarios) or 1.0
    for s in scenarios:
        s["probability"] = round(s["probability"] / total, 4)
    scenarios.sort(key=lambda x: x["probability"], reverse=True)
    return {
        "current_state": current_state,
        "scenarios": scenarios,
        "assessment": "What-if scenarios are probabilistic intelligence assessments, not deterministic predictions.",
    }


def counter_evidence_analysis(supporting: List[Dict[str, Any]], contradictory: List[Dict[str, Any]], base_confidence: float = 0.75) -> Dict[str, Any]:
    support_score = sum(float(x.get("confidence", x.get("weight", 0.5))) for x in supporting)
    contradiction_score = sum(float(x.get("confidence", x.get("weight", 0.5))) for x in contradictory)
    support_norm = support_score / max(1, len(supporting)) if supporting else 0.0
    contradiction_norm = contradiction_score / max(1, len(contradictory)) if contradictory else 0.0
    adjusted = clamp(float(base_confidence) + 0.18 * support_norm - 0.28 * contradiction_norm)
    false_link_risk = clamp(0.18 + 0.52 * contradiction_norm - 0.18 * support_norm)
    if false_link_risk >= 0.65:
        label = "high_false_link_risk"
    elif false_link_risk >= 0.40:
        label = "moderate_false_link_risk"
    else:
        label = "low_false_link_risk"
    return {
        "base_confidence": round(float(base_confidence), 4),
        "supporting_evidence": supporting,
        "contradictory_evidence": contradictory,
        "support_score": round(support_norm, 4),
        "contradiction_score": round(contradiction_norm, 4),
        "adjusted_confidence": adjusted,
        "false_link_risk": false_link_risk,
        "assessment": label,
        "reasoning": "Confidence is increased by independent support and reduced by contradictory evidence; absence of contradiction is not proof of attribution.",
    }


def adversarial_demo(base_confidence: float = 0.82, injected_signal: str = "shared_infrastructure",
                     counter_evidence: List[Dict[str, Any]] | None = None) -> Dict[str, Any]:
    counter_evidence = counter_evidence or [
        {"type": "stylometry_mismatch", "confidence": 0.86, "explanation": "Writing-style fingerprint differs from the target actor."},
        {"type": "temporal_mismatch", "confidence": 0.78, "explanation": "Activity timing does not match the established actor pattern."},
    ]
    injected = {"type": injected_signal, "confidence": 0.94, "explanation": "Synthetic misleading signal injected for resilience testing."}
    initial = clamp(float(base_confidence) + 0.10)
    result = counter_evidence_analysis([injected], counter_evidence, initial)
    return {
        "mode": "controlled_synthetic_adversarial_demo",
        "injected_signal": injected,
        "initial_confidence": initial,
        "adjusted_confidence": result["adjusted_confidence"],
        "false_link_risk": result["false_link_risk"],
        "counter_evidence": counter_evidence,
        "resilience_result": "resisted_false_link" if result["adjusted_confidence"] < initial else "needs_review",
        "assessment": "Synthetic signal only. This demonstration does not interact with real people or infrastructure.",
    }


def early_warning(risk_score: float, current_state: str, predicted_state: str,
                  prediction_probability: float, change_count: int,
                  campaign_confidence: float, adjusted_confidence: float,
                  false_link_risk: float = 0.0) -> Dict[str, Any]:
    risk = clamp(float(risk_score) / 100.0)
    transition = clamp(float(prediction_probability))
    change_pressure = min(int(change_count), 10) / 10.0
    campaign = clamp(float(campaign_confidence))
    attribution = clamp(float(adjusted_confidence))
    warning_score = clamp(0.30 * risk + 0.22 * transition + 0.18 * change_pressure + 0.18 * campaign + 0.12 * attribution - 0.10 * float(false_link_risk))
    if warning_score >= 0.78:
        severity = "CRITICAL"
    elif warning_score >= 0.62:
        severity = "HIGH"
    elif warning_score >= 0.45:
        severity = "ELEVATED"
    else:
        severity = "GUARDED"
    triggers = []
    if risk >= 0.70: triggers.append("elevated actor risk")
    if transition >= 0.70: triggers.append(f"likely state transition toward {predicted_state}")
    if change_count >= 2: triggers.append("recent behavioral or infrastructure changes")
    if campaign >= 0.70: triggers.append("emerging campaign confidence")
    if false_link_risk >= 0.50: triggers.append("counter-evidence requires attribution review")
    return {
        "warning_score": warning_score,
        "severity": severity,
        "current_state": current_state,
        "predicted_state": predicted_state,
        "prediction_probability": round(transition, 4),
        "triggers": triggers,
        "assessment": f"{severity} early-warning posture: monitor the predicted transition and validate independent evidence before attribution.",
        "defensive_actions": [
            "Prioritize monitoring of relevant defensive telemetry and indicators.",
            "Validate high-impact findings with independent evidence sources.",
            "Review campaign and infrastructure changes for escalation or migration.",
            "Preserve an evidence trail for analyst review and incident response.",
        ],
    }

from typing import Any, Dict, List


MITRE_TECHNIQUES = [
    {
        "id": "T1583",
        "name": "Acquire Infrastructure",
        "tactic": "Resource Development",
        "evidence_types": ["shared_infrastructure", "infrastructure_change"],
        "description": "Synthetic infrastructure-related evidence indicates possible preparation or reuse of infrastructure.",
    },
    {
        "id": "T1585",
        "name": "Establish Accounts",
        "tactic": "Resource Development",
        "evidence_types": ["alias_overlap", "persona_creation"],
        "description": "Multiple synthetic identities or aliases may indicate account establishment activity.",
    },
    {
        "id": "T1593",
        "name": "Search Open Websites/Domains",
        "tactic": "Reconnaissance",
        "evidence_types": ["reconnaissance", "web_activity"],
        "description": "Observed synthetic reconnaissance activity is mapped to public-web discovery behavior.",
    },
    {
        "id": "T1071",
        "name": "Application Layer Protocol",
        "tactic": "Command and Control",
        "evidence_types": ["network_activity", "infrastructure"],
        "description": "Synthetic network observations may indicate application-layer communication patterns.",
    },
    {
        "id": "T1588",
        "name": "Obtain Capabilities",
        "tactic": "Resource Development",
        "evidence_types": ["preparation", "capability_acquisition"],
        "description": "Preparation-stage evidence may indicate acquisition of capabilities or resources.",
    },
    {
        "id": "T1568",
        "name": "Dynamic Resolution",
        "tactic": "Command and Control",
        "evidence_types": ["migration", "evasion", "infrastructure_change"],
        "description": "Infrastructure migration or evasion signals may be consistent with dynamic resolution behavior.",
    },
]


def _clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, float(value)))


def _percent(value: float) -> float:
    return round(_clamp(value) * 100, 2)


def _safe_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


def build_behavioral_fingerprint(
    aliases: List[str] = None,
    platforms: List[str] = None,
    writing_style: str = "",
    activity_pattern: str = "",
) -> Dict[str, Any]:
    aliases = _safe_list(aliases)
    platforms = _safe_list(platforms)

    return {
        "aliases": aliases,
        "platforms": platforms,
        "writing_style": writing_style or "Not enough evidence",
        "activity_pattern": activity_pattern or "Not enough evidence",
        "fingerprint_strength": round(
            _clamp(
                (
                    (0.25 if aliases else 0.0)
                    + (0.25 if platforms else 0.0)
                    + (0.25 if writing_style else 0.0)
                    + (0.25 if activity_pattern else 0.0)
                )
            ),
            4,
        ),
    }


def map_mitre_attack(
    current_state: str = "Unknown",
    signal_types: List[str] = None,
    change_types: List[str] = None,
    confidence: float = 0.5,
) -> List[Dict[str, Any]]:
    signal_types = [str(x).lower() for x in _safe_list(signal_types)]
    change_types = [str(x).lower() for x in _safe_list(change_types)]

    observed = set(signal_types + change_types)
    state = (current_state or "Unknown").lower()

    mappings = []

    for technique in MITRE_TECHNIQUES:
        matched = [
            evidence_type
            for evidence_type in technique["evidence_types"]
            if evidence_type.lower() in observed
        ]

        state_match = False

        if technique["id"] == "T1593" and "recon" in state:
            state_match = True

        if technique["id"] == "T1588" and "preparation" in state:
            state_match = True

        if technique["id"] == "T1568" and (
            "migration" in state or "evasion" in state
        ):
            state_match = True

        if matched or state_match:
            evidence_strength = 0.15 * len(matched)
            state_strength = 0.15 if state_match else 0.0
            technique_confidence = _clamp(
                float(confidence) * 0.70 + evidence_strength + state_strength
            )

            mappings.append(
                {
                    "technique_id": technique["id"],
                    "technique_name": technique["name"],
                    "tactic": technique["tactic"],
                    "confidence": round(technique_confidence, 4),
                    "confidence_percent": _percent(technique_confidence),
                    "matched_evidence": matched,
                    "state_match": state_match,
                    "description": technique["description"],
                    "assessment_type": "synthetic intelligence mapping",
                }
            )

    if not mappings:
        mappings.append(
            {
                "technique_id": "UNMAPPED",
                "technique_name": "Insufficient Evidence",
                "tactic": "Unknown",
                "confidence": 0.0,
                "confidence_percent": 0.0,
                "matched_evidence": [],
                "state_match": False,
                "description": "No supported synthetic behavior was strong enough for an ATT&CK mapping.",
                "assessment_type": "synthetic intelligence mapping",
            }
        )

    return mappings


def build_analyst_summary(
    actor_id: str = "ACTOR-SYNTH-001",
    current_state: str = "Preparation",
    risk_score: float = 70,
    confidence: float = 0.75,
    predicted_state: str = "Operational Activity",
    prediction_probability: float = 0.80,
    what_changed: List[str] = None,
    supporting_evidence: List[str] = None,
    contradictory_evidence: List[str] = None,
) -> Dict[str, Any]:
    what_changed = _safe_list(what_changed)
    supporting_evidence = _safe_list(supporting_evidence)
    contradictory_evidence = _safe_list(contradictory_evidence)

    risk = _clamp(float(risk_score) / 100.0)
    prediction = _clamp(prediction_probability)

    if risk >= 0.80:
        assessment = "High-priority intelligence assessment"
    elif risk >= 0.60:
        assessment = "Elevated intelligence assessment"
    elif risk >= 0.40:
        assessment = "Moderate intelligence assessment"
    else:
        assessment = "Low immediate-risk intelligence assessment"

    return {
        "actor_id": actor_id,
        "assessment": assessment,
        "what_we_know": [
            f"Current operational state: {current_state}.",
            f"Current risk score: {round(float(risk_score), 2)}/100.",
            f"Assessment confidence: {_percent(confidence)}%.",
        ],
        "what_changed": what_changed
        or ["No newly supplied changes were identified."],
        "what_may_happen_next": [
            f"Predicted next state: {predicted_state}.",
            f"Prediction probability: {_percent(prediction)}%.",
        ],
        "supporting_evidence": supporting_evidence
        or ["No supporting evidence items were supplied."],
        "contradictions": contradictory_evidence
        or ["No contradictory evidence items were supplied."],
        "why_the_system_believes_it": (
            "The assessment combines the supplied behavioral, temporal, "
            "infrastructure, campaign and state evidence into a probabilistic "
            "intelligence assessment."
        ),
        "analyst_note": (
            "This is an intelligence assessment generated from synthetic/demo "
            "evidence. It is not a confirmed attribution or identification."
        ),
    }


def generate_intelligence_report(
    actor_id: str = "ACTOR-SYNTH-001",
    aliases: List[str] = None,
    platforms: List[str] = None,
    writing_style: str = "",
    activity_pattern: str = "",
    infrastructure: List[str] = None,
    blockchain_signals: List[str] = None,
    campaigns: List[str] = None,
    timeline: List[Dict[str, Any]] = None,
    current_state: str = "Preparation",
    risk_score: float = 70,
    state_confidence: float = 0.75,
    predicted_state: str = "Operational Activity",
    prediction_probability: float = 0.80,
    what_changed: List[str] = None,
    supporting_evidence: List[str] = None,
    contradictory_evidence: List[str] = None,
    signal_types: List[str] = None,
    change_types: List[str] = None,
    indicators: List[str] = None,
    recommendations: List[str] = None,
) -> Dict[str, Any]:

    aliases = _safe_list(aliases)
    platforms = _safe_list(platforms)
    infrastructure = _safe_list(infrastructure)
    blockchain_signals = _safe_list(blockchain_signals)
    campaigns = _safe_list(campaigns)
    timeline = _safe_list(timeline)
    indicators = _safe_list(indicators)
    recommendations = _safe_list(recommendations)

    risk_score = max(0.0, min(100.0, float(risk_score)))
    state_confidence = _clamp(state_confidence)
    prediction_probability = _clamp(prediction_probability)

    behavioral_fingerprint = build_behavioral_fingerprint(
        aliases=aliases,
        platforms=platforms,
        writing_style=writing_style,
        activity_pattern=activity_pattern,
    )

    mitre = map_mitre_attack(
        current_state=current_state,
        signal_types=signal_types,
        change_types=change_types,
        confidence=state_confidence,
    )

    analyst_summary = build_analyst_summary(
        actor_id=actor_id,
        current_state=current_state,
        risk_score=risk_score,
        confidence=state_confidence,
        predicted_state=predicted_state,
        prediction_probability=prediction_probability,
        what_changed=what_changed,
        supporting_evidence=supporting_evidence,
        contradictory_evidence=contradictory_evidence,
    )

    if risk_score >= 80:
        risk_label = "CRITICAL"
    elif risk_score >= 60:
        risk_label = "HIGH"
    elif risk_score >= 40:
        risk_label = "MEDIUM"
    else:
        risk_label = "LOW"

    executive_summary = (
        f"{actor_id} is assessed as {risk_label} risk with a "
        f"{current_state} operational state. "
        f"The current assessment confidence is {_percent(state_confidence)}%. "
        f"The most likely next state is {predicted_state} with "
        f"{_percent(prediction_probability)}% estimated probability."
    )

    if not recommendations:
        recommendations = [
            "Validate high-impact indicators against trusted internal telemetry.",
            "Increase monitoring of newly changed infrastructure and identities.",
            "Preserve supporting and contradictory evidence for analyst review.",
            "Review mapped ATT&CK behaviors and prioritize relevant defensive controls.",
            "Treat attribution as probabilistic until independently corroborated.",
        ]

    return {
        "report_version": "DARKTRACE-X-BATCH4-1.0",
        "report_type": "Automatic Intelligence Assessment",
        "generated_for": actor_id,
        "executive_summary": executive_summary,
        "actor_profile": {
            "actor_id": actor_id,
            "aliases": aliases,
            "platforms": platforms,
        },
        "behavioral_fingerprint": behavioral_fingerprint,
        "infrastructure": infrastructure,
        "blockchain_signals": blockchain_signals,
        "campaigns": campaigns,
        "timeline": timeline,
        "operational_state": {
            "current_state": current_state,
            "confidence": round(state_confidence, 4),
            "confidence_percent": _percent(state_confidence),
        },
        "predictions": {
            "predicted_next_state": predicted_state,
            "probability": round(prediction_probability, 4),
            "probability_percent": _percent(prediction_probability),
        },
        "what_changed": what_changed
        or ["No newly supplied changes were identified."],
        "counter_evidence": contradictory_evidence
        or ["No contradictory evidence supplied."],
        "confidence_assessment": {
            "overall_confidence": round(state_confidence, 4),
            "overall_confidence_percent": _percent(state_confidence),
            "risk_score": round(risk_score, 2),
            "risk_label": risk_label,
        },
        "mitre_attack": mitre,
        "indicators": indicators,
        "defensive_recommendations": recommendations,
        "analyst_summary": analyst_summary,
        "evidence_statement": (
            "The report is generated from supplied synthetic intelligence "
            "signals and should be interpreted as an analyst-support artifact, "
            "not proof of real-world identity."
        ),
    }

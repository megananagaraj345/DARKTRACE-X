from typing import List, Dict


OPERATIONAL_STATE_EVENT_MAP = {
    "reconnaissance": {
        "event_type": "RECONNAISSANCE_ACTIVITY",
        "description": "Reconnaissance activity detected"
    },
    "targeting": {
        "event_type": "TARGETING_ACTIVITY",
        "description": "Targeting activity detected"
    },
    "access_seeking": {
        "event_type": "ACCESS_SEEKING_ACTIVITY",
        "description": "Access-seeking activity detected"
    },
    "preparation": {
        "event_type": "PREPARATION_ACTIVITY",
        "description": "Preparation activity detected"
    },
    "operational_activity": {
        "event_type": "OPERATIONAL_ACTIVITY",
        "description": "Operational activity detected"
    },
    "impact": {
        "event_type": "IMPACT_MONETIZATION_ACTIVITY",
        "description": "Impact or monetization activity detected"
    },
    "monetization": {
        "event_type": "IMPACT_MONETIZATION_ACTIVITY",
        "description": "Impact or monetization activity detected"
    },
    "migration": {
        "event_type": "MIGRATION_EVASION_ACTIVITY",
        "description": "Migration or evasion activity detected"
    },
    "evasion": {
        "event_type": "MIGRATION_EVASION_ACTIVITY",
        "description": "Migration or evasion activity detected"
    }
}


def clamp(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def normalize_signal(signal: Dict) -> Dict:
    signal_type = str(signal.get("type", "")).strip().lower()

    confidence = clamp(
        signal.get("confidence", 0.0)
    )

    description = signal.get(
        "description",
        signal_type or "Unknown signal"
    )

    source = signal.get(
        "source",
        "activity_replay_engine"
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


def convert_signal_to_event(
    actor_id: str,
    signal: Dict
) -> Dict | None:

    normalized = normalize_signal(signal)

    signal_type = normalized["type"]

    mapping = OPERATIONAL_STATE_EVENT_MAP.get(
        signal_type
    )

    if not mapping:
        return None

    return {
        "actor_id": actor_id,
        "event_type": mapping["event_type"],
        "description": normalized["description"],
        "confidence": normalized["confidence"],
        "source": normalized["source"],
        "related_entity": normalized["related_entity"],
        "operational_state": signal_type.replace(
            "_",
            " "
        ).title()
    }


def reconstruct_activity_replay(
    actor_id: str,
    signals: List[Dict]
) -> Dict:

    events = []
    ignored_signals = []

    for signal in signals:

        event = convert_signal_to_event(
            actor_id=actor_id,
            signal=signal
        )

        if event is None:
            ignored_signals.append(signal)
            continue

        events.append(event)

    events.sort(
        key=lambda event: event["confidence"],
        reverse=True
    )

    return {
        "actor_id": actor_id,
        "event_count": len(events),
        "events": events,
        "ignored_signal_count": len(
            ignored_signals
        ),
        "ignored_signals": ignored_signals
    }
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List


def _parse_timestamp(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return dt.astimezone(timezone.utc) if dt.tzinfo else dt
    except ValueError:
        return None


def build_temporal_fingerprint(timestamps: Iterable[Any]) -> Dict[str, Any]:
    parsed = [dt for dt in (_parse_timestamp(x) for x in timestamps) if dt is not None]
    hours = [dt.hour for dt in parsed]
    weekdays = [dt.weekday() for dt in parsed]

    hour_counts = {str(h): hours.count(h) for h in range(24)}
    weekday_counts = {str(d): weekdays.count(d) for d in range(7)}

    peak_hours = sorted((int(h) for h in hour_counts), key=lambda h: hour_counts[str(h)], reverse=True)[:3]
    active_hours = [h for h, count in hour_counts.items() if count > 0]

    if active_hours:
        first = min(int(h) for h in active_hours)
        last = max(int(h) for h in active_hours)
        activity_window = f"{first:02d}:00–{last:02d}:59"
    else:
        activity_window = "No activity timestamps"

    return {
        "event_count": len(parsed),
        "hour_distribution": hour_counts,
        "weekday_distribution": weekday_counts,
        "peak_hours_utc": [f"{h:02d}:00" for h in peak_hours if hour_counts[str(h)] > 0],
        "activity_window_utc": activity_window,
        "active_hour_count": len(active_hours),
        "night_activity_ratio": round(
            sum(1 for h in hours if h >= 20 or h < 6) / len(hours), 4
        ) if hours else 0.0,
        "weekend_activity_ratio": round(
            sum(1 for d in weekdays if d >= 5) / len(weekdays), 4
        ) if weekdays else 0.0,
    }


def compare_temporal_fingerprints(
    timestamps_a: Iterable[Any],
    timestamps_b: Iterable[Any],
) -> Dict[str, Any]:
    a = build_temporal_fingerprint(timestamps_a)
    b = build_temporal_fingerprint(timestamps_b)

    hour_a = a["hour_distribution"]
    hour_b = b["hour_distribution"]
    total_a = sum(hour_a.values()) or 1
    total_b = sum(hour_b.values()) or 1

    overlap = sum(
        min(hour_a[str(h)] / total_a, hour_b[str(h)] / total_b)
        for h in range(24)
    )

    night_similarity = 1.0 - abs(
        a["night_activity_ratio"] - b["night_activity_ratio"]
    )
    weekend_similarity = 1.0 - abs(
        a["weekend_activity_ratio"] - b["weekend_activity_ratio"]
    )

    score = overlap * 0.70 + night_similarity * 0.20 + weekend_similarity * 0.10

    return {
        "similarity": round(max(0.0, min(1.0, score)), 4),
        "similarity_percent": round(score * 100, 1),
        "components": {
            "hour_distribution": round(overlap, 4),
            "night_activity": round(night_similarity, 4),
            "weekend_activity": round(weekend_similarity, 4),
        },
        "fingerprint_a": a,
        "fingerprint_b": b,
        "assessment": (
            "Strong temporal alignment"
            if score >= 0.80
            else "Moderate temporal alignment"
            if score >= 0.60
            else "Weak temporal alignment"
        ),
        "disclaimer": (
            "Temporal alignment is a correlation signal and is not proof of shared identity."
        ),
    }

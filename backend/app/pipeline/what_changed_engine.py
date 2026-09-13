from typing import Any, Dict, List


def normalize_list(value: Any) -> List[str]:
    """
    Convert stored actor attributes into a clean list.

    Supports:
    - None
    - lists
    - comma-separated strings
    - newline-separated strings
    """
    if value is None:
        return []

    if isinstance(value, list):
        return [
            str(item).strip()
            for item in value
            if str(item).strip()
        ]

    text = str(value).strip()

    if not text:
        return []

    separators = [",", "\n", "|"]

    for separator in separators:
        if separator in text:
            return [
                item.strip()
                for item in text.split(separator)
                if item.strip()
            ]

    return [text]


def calculate_numeric_change(
    old_value: Any,
    new_value: Any
) -> Dict[str, Any]:

    try:
        old_number = float(old_value)
        new_number = float(new_value)
    except (TypeError, ValueError):
        return {
            "changed": old_value != new_value,
            "old_value": old_value,
            "new_value": new_value,
            "difference": None
        }

    difference = round(
        new_number - old_number,
        4
    )

    return {
        "changed": difference != 0,
        "old_value": old_number,
        "new_value": new_number,
        "difference": difference
    }


def compare_lists(
    field_name: str,
    old_value: Any,
    new_value: Any
) -> Dict[str, Any]:

    old_items = set(
        normalize_list(old_value)
    )

    new_items = set(
        normalize_list(new_value)
    )

    added = sorted(
        new_items - old_items
    )

    removed = sorted(
        old_items - new_items
    )

    return {
        "field": field_name,
        "added": added,
        "removed": removed,
        "changed": bool(added or removed)
    }


def compare_snapshots(
    previous: Dict[str, Any],
    current: Dict[str, Any]
) -> Dict[str, Any]:

    changes = []

    list_fields = [
        "aliases",
        "platforms",
        "infrastructure",
        "wallets",
        "campaigns"
    ]

    for field in list_fields:

        result = compare_lists(
            field_name=field,
            old_value=previous.get(field),
            new_value=current.get(field)
        )

        if result["changed"]:
            changes.append(result)

    text_fields = [
        "display_name",
        "writing_style",
        "activity_pattern",
        "current_state",
        "analyst_assessment"
    ]

    for field in text_fields:

        old_value = previous.get(field)
        new_value = current.get(field)

        if old_value != new_value:

            changes.append({
                "field": field,
                "old_value": old_value,
                "new_value": new_value,
                "changed": True
            })

    numeric_fields = [
        "confidence",
        "risk_score",
        "state_confidence"
    ]

    for field in numeric_fields:

        result = calculate_numeric_change(
            old_value=previous.get(field),
            new_value=current.get(field)
        )

        if result["changed"]:

            changes.append({
                "field": field,
                **result
            })

    return {
        "actor_id": current.get(
            "actor_id",
            previous.get("actor_id")
        ),
        "change_count": len(changes),
        "changes": changes
    }


def generate_change_summary(
    comparison: Dict[str, Any]
) -> List[str]:

    summary = []

    for change in comparison["changes"]:

        field = change["field"]

        if "added" in change:

            for item in change["added"]:
                summary.append(
                    f"New {field} detected: {item}"
                )

            for item in change["removed"]:
                summary.append(
                    f"{field.capitalize()} no longer observed: {item}"
                )

        elif field == "risk_score":

            difference = change["difference"]

            if difference > 0:
                summary.append(
                    f"Risk score increased by {difference}"
                )
            elif difference < 0:
                summary.append(
                    f"Risk score decreased by {abs(difference)}"
                )

        elif field == "confidence":

            difference = change["difference"]

            if difference > 0:
                summary.append(
                    f"Actor confidence increased by {difference}"
                )
            elif difference < 0:
                summary.append(
                    f"Actor confidence decreased by {abs(difference)}"
                )

        elif field == "state_confidence":

            difference = change["difference"]

            if difference > 0:
                summary.append(
                    f"Operational-state confidence increased by {difference}"
                )
            elif difference < 0:
                summary.append(
                    f"Operational-state confidence decreased by {abs(difference)}"
                )

        elif field == "current_state":

            summary.append(
                f"Operational state changed from "
                f"'{change['old_value']}' to "
                f"'{change['new_value']}'"
            )

        else:

            summary.append(
                f"{field.replace('_', ' ').capitalize()} changed"
            )

    if not summary:

        summary.append(
            "No significant changes detected between the two actor snapshots."
        )

    return summary


def analyze_actor_changes(
    previous: Dict[str, Any],
    current: Dict[str, Any]
) -> Dict[str, Any]:

    comparison = compare_snapshots(
        previous=previous,
        current=current
    )

    summary = generate_change_summary(
        comparison
    )

    return {
        "actor_id": comparison["actor_id"],
        "change_count": comparison["change_count"],
        "changes": comparison["changes"],
        "summary": summary
    }
from typing import List, Dict


def calculate_fusion_score(
    signals: List[Dict]
) -> float:
    """
    Calculate an initial fusion score by combining
    multiple intelligence signals using weighted averaging.

    This is the DARKTRACE-X Fusion Engine v0.
    """

    if not signals:
        return 0.0

    total_weight = 0.0
    weighted_score = 0.0

    for signal in signals:
        confidence = float(signal.get("confidence", 0.0))
        weight = float(signal.get("weight", 1.0))

        confidence = max(0.0, min(1.0, confidence))
        weight = max(0.0, weight)

        weighted_score += confidence * weight
        total_weight += weight

    if total_weight == 0:
        return 0.0

    fusion_score = weighted_score / total_weight

    return round(fusion_score, 4)


def classify_relationship(score: float) -> str:
    """
    Convert the fusion score into an explainable
    relationship assessment.
    """

    if score >= 0.80:
        return "high_confidence_relationship"

    if score >= 0.60:
        return "probable_relationship"

    if score >= 0.40:
        return "possible_relationship"

    return "weak_relationship"
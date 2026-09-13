import re
from typing import Any, Dict, Iterable, Set


def normalize_entities(value: Any) -> Set[str]:
    if value is None:
        return set()
    if isinstance(value, (list, tuple, set)):
        return {str(x).strip().lower() for x in value if str(x).strip()}
    text = str(value).strip()
    if not text:
        return set()
    return {
        x.strip().lower()
        for x in re.split(r"[,|\n;]+", text)
        if x.strip()
    }


def build_infrastructure_fingerprint(
    infrastructure: Any = None,
    domains: Any = None,
    servers: Any = None,
    certificates: Any = None,
) -> Dict[str, Any]:
    infra = normalize_entities(infrastructure)
    dom = normalize_entities(domains)
    srv = normalize_entities(servers)
    cert = normalize_entities(certificates)

    all_entities = infra | dom | srv | cert

    return {
        "infrastructure_count": len(infra),
        "domain_count": len(dom),
        "server_count": len(srv),
        "certificate_count": len(cert),
        "total_unique_entities": len(all_entities),
        "infrastructure": sorted(infra),
        "domains": sorted(dom),
        "servers": sorted(srv),
        "certificates": sorted(cert),
        "entity_types": {
            "infrastructure": len(infra),
            "domains": len(dom),
            "servers": len(srv),
            "certificates": len(cert),
        },
    }


def compare_infrastructure(
    actor_a: Dict[str, Any],
    actor_b: Dict[str, Any],
) -> Dict[str, Any]:
    fields = {
        "infrastructure": actor_a.get("infrastructure"),
        "domains": actor_a.get("domains"),
        "servers": actor_a.get("servers"),
        "certificates": actor_a.get("certificates"),
    }

    shared = {}
    for field, value_a in fields.items():
        value_b = actor_b.get(field)
        overlap = sorted(
            normalize_entities(value_a) & normalize_entities(value_b)
        )
        if overlap:
            shared[field] = overlap

    a_all = set().union(*(normalize_entities(actor_a.get(k)) for k in fields))
    b_all = set().union(*(normalize_entities(actor_b.get(k)) for k in fields))
    union = a_all | b_all
    jaccard = len(a_all & b_all) / len(union) if union else 0.0

    return {
        "shared_entities": shared,
        "shared_entity_count": sum(len(v) for v in shared.values()),
        "similarity": round(jaccard, 4),
        "similarity_percent": round(jaccard * 100, 1),
        "assessment": (
            "Strong infrastructure overlap"
            if jaccard >= 0.60
            else "Moderate infrastructure overlap"
            if jaccard >= 0.30
            else "Limited infrastructure overlap"
        ),
        "disclaimer": (
            "Infrastructure overlap is an intelligence correlation and may reflect "
            "shared services or deliberate reuse."
        ),
    }

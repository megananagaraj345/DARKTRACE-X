from collections import defaultdict
from typing import Any, Dict, Iterable, List


def _amount(tx: Dict[str, Any]) -> float:
    try:
        return float(tx.get("amount", 0.0))
    except (TypeError, ValueError):
        return 0.0


def build_wallet_fingerprint(
    wallet_id: str,
    transactions: Iterable[Dict[str, Any]],
) -> Dict[str, Any]:
    txs = [dict(tx) for tx in transactions]
    counterparties = set()
    exchanges = set()
    total_in = 0.0
    total_out = 0.0

    for tx in txs:
        sender = str(tx.get("from", "")).strip()
        receiver = str(tx.get("to", "")).strip()
        direction = str(tx.get("direction", "")).lower()
        amount = _amount(tx)

        if sender and sender != wallet_id:
            counterparties.add(sender)
        if receiver and receiver != wallet_id:
            counterparties.add(receiver)

        service = tx.get("exchange") or tx.get("service")
        if service:
            exchanges.add(str(service).strip().lower())

        if direction == "in" or receiver == wallet_id:
            total_in += amount
        elif direction == "out" or sender == wallet_id:
            total_out += amount

    return {
        "wallet_id": wallet_id,
        "transaction_count": len(txs),
        "counterparty_count": len(counterparties),
        "counterparties": sorted(counterparties),
        "service_touchpoints": sorted(exchanges),
        "total_in": round(total_in, 6),
        "total_out": round(total_out, 6),
        "net_flow": round(total_in - total_out, 6),
    }


def compare_wallets(
    wallet_a: Dict[str, Any],
    wallet_b: Dict[str, Any],
) -> Dict[str, Any]:
    a = set(wallet_a.get("counterparties", []))
    b = set(wallet_b.get("counterparties", []))
    ea = set(wallet_a.get("service_touchpoints", []))
    eb = set(wallet_b.get("service_touchpoints", []))

    shared_counterparties = sorted(a & b)
    shared_services = sorted(ea & eb)

    score = min(
        1.0,
        (len(shared_counterparties) * 0.20)
        + (len(shared_services) * 0.15)
    )

    return {
        "shared_counterparties": shared_counterparties,
        "shared_services": shared_services,
        "similarity": round(score, 4),
        "similarity_percent": round(score * 100, 1),
        "assessment": (
            "Strong wallet-cluster overlap"
            if score >= 0.70
            else "Moderate wallet overlap"
            if score >= 0.40
            else "Limited wallet overlap"
        ),
        "disclaimer": (
            "Blockchain linkage is an intelligence signal based on supplied synthetic "
            "transaction data; it does not identify a real-world owner."
        ),
    }

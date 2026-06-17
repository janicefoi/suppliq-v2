"""
Supplier Intelligence & Scoring Service

What this will do:
  1. Pull 180 days of purchase order history from the DB
  2. Compute per-supplier metrics:
       - Average lead time (created_at → delivered_at)
       - Price variance (std dev of unit costs across orders)
       - Order fill rate (received_qty / ordered_qty)
       - Order frequency & recency
       - Total spend and spend trend
  3. Score each supplier 0-100 across 3 dimensions
  4. Pass metrics to Claude for a risk narrative + recommendation
  5. Flag high-risk suppliers as alerts

Risk levels:
  score 75-100 → "low"    (reliable, price-stable)
  score 50-74  → "medium" (some concerns)
  score 0-49   → "high"   (diversify or review)

Phase 2:
  - Add external credit check signals (where available for KE market)
  - Cross-reference supplier against news feed (named entity detection)
  - Detect if a supplier is a single point of failure (>60% of item sourcing)
"""

from utils.db import get_purchase_order_history, get_suppliers_for_org, get_org_details
from utils.llm import score_supplier


def _compute_supplier_metrics(orders: list[dict], supplier_id: str) -> dict:
    """Compute raw metrics for a single supplier from PO history."""
    supplier_orders = [o for o in orders if o["supplier_id"] == supplier_id]
    if not supplier_orders:
        return {}

    # Lead time: days from created_at to delivered_at
    lead_times = []
    for o in supplier_orders:
        if o.get("delivered_at") and o.get("created_at"):
            delta = (o["delivered_at"] - o["created_at"]).days
            if delta >= 0:
                lead_times.append(delta)

    # Price variance per item
    item_prices: dict[str, list[float]] = {}
    for o in supplier_orders:
        key = o["item_id"]
        item_prices.setdefault(key, []).append(float(o["cost_price"]))

    price_variances = []
    for prices in item_prices.values():
        if len(prices) > 1:
            import statistics
            mean = statistics.mean(prices)
            if mean > 0:
                price_variances.append(statistics.stdev(prices) / mean * 100)

    # Order fill rate: received_qty / ordered_qty (if tracked)
    # Currently schema stores receivedQty on PurchaseOrderItem
    # TODO: JOIN purchase_order_items.received_qty in the DB query

    return {
        "supplier_id": supplier_id,
        "order_count": len(set(o["po_id"] for o in supplier_orders)),
        "avg_lead_days": round(sum(lead_times) / len(lead_times), 1) if lead_times else None,
        "max_lead_days": max(lead_times) if lead_times else None,
        "price_variance_pct": round(sum(price_variances) / len(price_variances), 1) if price_variances else 0.0,
        "fill_rate_pct": 100.0,  # placeholder until received_qty is in query
        "total_spend": sum(float(o["cost_price"]) * o["quantity"] for o in supplier_orders),
    }


def _compute_score(metrics: dict) -> tuple[float, float, float, float]:
    """
    Returns (overall, delivery_reliability, pricing_consistency, fill_rate) 0-100.
    """
    # Delivery reliability (0-100): penalise long / inconsistent lead times
    if metrics.get("avg_lead_days") is None:
        delivery = 50.0  # not enough data
    else:
        # <3 days = 100, 7 days = 80, 14 days = 60, >21 days = 40
        avg = metrics["avg_lead_days"]
        delivery = max(0, min(100, 100 - (avg - 3) * 3))

    # Pricing consistency (0-100): penalise high price variance
    variance = metrics.get("price_variance_pct", 0)
    pricing = max(0, min(100, 100 - variance * 2))

    # Fill rate (0-100)
    fill = metrics.get("fill_rate_pct", 100.0)

    overall = round(0.4 * delivery + 0.35 * pricing + 0.25 * fill, 1)
    return overall, round(delivery, 1), round(pricing, 1), round(fill, 1)


def _risk_level(score: float) -> str:
    if score >= 75:
        return "low"
    if score >= 50:
        return "medium"
    return "high"


async def score_all_suppliers(org_id: str) -> list[dict]:
    """
    Returns scored supplier list for an org, enriched with Claude narrative.
    """
    import asyncio
    [org, orders, suppliers] = await asyncio.gather(
        get_org_details(org_id),
        get_purchase_order_history(org_id, days=180),
        get_suppliers_for_org(org_id),
    )
    currency = org["currency"] if org else "EUR"

    results = []
    for supplier in suppliers:
        sid = supplier["id"]
        metrics = _compute_supplier_metrics(orders, sid)
        if not metrics or metrics["order_count"] == 0:
            continue  # skip suppliers with no orders

        overall, delivery, pricing, fill = _compute_score(metrics)
        narrative = await score_supplier(supplier["name"], metrics, currency=currency)

        results.append({
            "supplier_id": sid,
            "supplier_name": supplier["name"],
            "overall_score": overall,
            "delivery_reliability": delivery,
            "pricing_consistency": pricing,
            "order_fill_rate": fill,
            "risk_level": _risk_level(overall),
            "recommendation": narrative,
            "metrics": metrics,
        })

    results.sort(key=lambda x: x["overall_score"])  # worst first
    return results

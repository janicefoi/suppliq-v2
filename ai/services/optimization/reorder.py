"""
Reorder Point Optimisation Service

Dynamic ROP formula (Phase 1 — EMA demand):
    ROP = avg_daily_demand × lead_time × 1.5
    (the 1.5× factor is a simplified safety stock: 100% of lead-time demand + 50% buffer)

Phase 2 upgrade path:
    safety_stock = Z × σ_demand × √lead_time   (Z=1.65 for 95% service level)
    Requires per-item demand variance, which we'll have once we accumulate forecast history.

EOQ formula (currency-agnostic):
    √(2DS / H)    where S = ORDER_COST_RATIO × unit_cost,  H = HOLDING_COST_PCT × unit_cost

The nightly job calls update_reorder_points() immediately after demand forecasting,
so ROPs are always derived from the freshest EMA demand estimate.
"""

import asyncio
import logging
import math
from datetime import datetime, timezone

from utils.db import (
    get_branch_stock,
    get_latest_forecasts_by_item_branch,
    get_purchase_order_history,
    get_supplier_avg_lead_times,
    get_item_preferred_supplier,
    get_org_details,
    update_branch_rop,
)
from utils.llm import generate_reorder_reasoning

logger = logging.getLogger(__name__)

DEFAULT_LEAD_TIME_DAYS = 5
ORDER_COST_RATIO       = 0.02   # 2% of unit cost — currency-agnostic
HOLDING_COST_PCT       = 0.20   # 20% annual holding cost
SAFETY_BUFFER          = 0.5    # 50% of lead-time demand added as safety stock
MIN_ROP                = 2      # never set threshold below 2 units


# ── Pure calculation helpers ───────────────────────────────────────────────

def calculate_rop(avg_daily: float, lead_time: float) -> int:
    """
    ROP = ceil(avg_daily × lead_time × (1 + SAFETY_BUFFER))

    Phase 1 approximation.  Phase 2 will replace SAFETY_BUFFER with
    Z × coefficient_of_variation × √lead_time once we have demand variance.
    """
    if avg_daily <= 0:
        return MIN_ROP
    rop = math.ceil(avg_daily * lead_time * (1 + SAFETY_BUFFER))
    return max(rop, MIN_ROP)


def _estimate_lead_time(
    orders: list[dict],
    item_id: str,
    supplier_lead_times: dict[str, float] | None = None,
    item_preferred_supplier: dict[str, str] | None = None,
) -> float:
    """
    Lead time estimate with three-tier priority:

    1. Supplier-level avg lead time (most accurate — reflects actual delivery reliability)
       Slow supplier → higher lead time → higher ROP → earlier reorder trigger.
    2. Item-level avg lead time from raw PO history (cross-supplier fallback).
    3. DEFAULT_LEAD_TIME_DAYS (no delivered POs at all).
    """
    # 1. Supplier-level (preferred): find this item's most-recent supplier, use their avg
    if supplier_lead_times and item_preferred_supplier:
        sid = item_preferred_supplier.get(item_id)
        if sid and sid in supplier_lead_times:
            return supplier_lead_times[sid]

    # 2. Item-level fallback: average across all suppliers who have delivered this item
    item_orders = [
        o for o in orders
        if o["item_id"] == item_id
        and o.get("delivered_at") and o.get("created_at")
    ]
    if item_orders:
        lead_times = [
            (o["delivered_at"] - o["created_at"]).days
            for o in item_orders
            if (o["delivered_at"] - o["created_at"]).days >= 0
        ]
        if lead_times:
            return sum(lead_times) / len(lead_times)

    return DEFAULT_LEAD_TIME_DAYS


def _calculate_eoq(annual_demand: float, unit_cost: float) -> int:
    if annual_demand <= 0 or unit_cost <= 0:
        return 0
    S = max(unit_cost * ORDER_COST_RATIO, 1.0)
    H = unit_cost * HOLDING_COST_PCT
    return max(1, round(math.sqrt((2 * annual_demand * S) / H)))


def _priority(days_until_stockout: float | None) -> str:
    if days_until_stockout is None:
        return "medium"
    if days_until_stockout <= 0:
        return "critical"
    if days_until_stockout <= 3:
        return "critical"
    if days_until_stockout <= 7:
        return "high"
    if days_until_stockout <= 14:
        return "medium"
    return "low"


# ── ROP write-back ─────────────────────────────────────────────────────────

async def update_reorder_points(org_id: str) -> dict:
    """
    Calculate AI-driven ROPs from fresh demand forecasts and write them
    back to branch_stocks.low_stock_threshold.

    Called automatically by the nightly job after demand forecasting.
    Also callable manually via POST /optimize/apply-rop/{org_id}.

    Returns a summary:
        { "updated": N, "skipped": N, "elapsed_seconds": f }
    """
    started_at = datetime.now(timezone.utc)

    forecasts = await get_latest_forecasts_by_item_branch(org_id)
    if not forecasts:
        logger.info("ROP update: no fresh forecasts for org=%s — skipping", org_id)
        return {"updated": 0, "skipped": 0, "elapsed_seconds": 0.0, "reason": "no_fresh_forecasts"}

    # Fetch PO history, supplier lead times, and item→supplier mapping in parallel.
    # Supplier lead times are the primary source — they reflect actual delivery reliability.
    orders, supplier_lead_times, item_preferred_supplier = await asyncio.gather(
        get_purchase_order_history(org_id, days=180),
        get_supplier_avg_lead_times(org_id),
        get_item_preferred_supplier(org_id),
    )

    logger.info(
        "ROP update: org=%s  suppliers_with_lead_data=%d  items_with_known_supplier=%d",
        org_id, len(supplier_lead_times), len(item_preferred_supplier),
    )

    updated = 0
    skipped = 0

    for (item_id, branch_id), demand_data in forecasts.items():
        avg_daily  = demand_data["avg_daily_demand"]
        lead_time  = _estimate_lead_time(
            orders, item_id,
            supplier_lead_times=supplier_lead_times,
            item_preferred_supplier=item_preferred_supplier,
        )
        rop        = calculate_rop(avg_daily, lead_time)

        was_updated = await update_branch_rop(item_id, branch_id, rop)
        if was_updated:
            updated += 1
            logger.debug(
                "  ROP  item=%s  branch=%s  avg_daily=%.2f  lead_time=%.1fd  rop=%d",
                item_id, branch_id, avg_daily, lead_time, rop,
            )
        else:
            skipped += 1

    elapsed = (datetime.now(timezone.utc) - started_at).total_seconds()
    logger.info(
        "ROP update complete — org=%s  updated=%d  skipped=%d  elapsed=%.1fs",
        org_id, updated, skipped, elapsed,
    )
    return {
        "updated":         updated,
        "skipped":         skipped,
        "elapsed_seconds": round(elapsed, 2),
    }


# ── Reorder recommendations ────────────────────────────────────────────────

async def get_reorder_recommendations(org_id: str) -> list[dict]:
    """
    Returns reorder recommendations sorted by priority (critical first).

    Uses real AI demand forecasts (not placeholders).  The ROP in
    branch_stocks.low_stock_threshold is already AI-calculated if
    update_reorder_points() has run at least once.
    """
    org      = await get_org_details(org_id)
    currency = org["currency"] if org else "EUR"

    stocks, orders, forecasts, supplier_lead_times, item_preferred_supplier = await asyncio.gather(
        get_branch_stock(org_id),
        get_purchase_order_history(org_id, days=180),
        get_latest_forecasts_by_item_branch(org_id),
        get_supplier_avg_lead_times(org_id),
        get_item_preferred_supplier(org_id),
    )

    recommendations = []

    for stock in stocks:
        item_id    = stock["item_id"]
        branch_id  = stock["branch_id"]
        current_qty   = stock["stock_qty"]
        reorder_point = stock.get("low_stock_threshold", MIN_ROP)
        unit_cost     = float(stock.get("wholesale_price") or stock.get("retail_price") or 0) * 0.7

        # Real demand from forecast table; fall back to heuristic if no forecast yet
        demand_data = forecasts.get((item_id, branch_id))
        if demand_data:
            avg_daily    = demand_data["avg_daily_demand"]
            confidence   = demand_data["confidence_score"]
        else:
            avg_daily    = max(0.5, reorder_point * 0.10)   # heuristic fallback
            confidence   = 0.4

        if current_qty > reorder_point:
            continue  # stock is healthy — nothing to do

        days_until_stockout = (current_qty / avg_daily) if avg_daily > 0 else None
        annual_demand       = avg_daily * 365
        eoq                 = _calculate_eoq(annual_demand, unit_cost)
        lead_time           = _estimate_lead_time(
            orders, item_id,
            supplier_lead_times=supplier_lead_times,
            item_preferred_supplier=item_preferred_supplier,
        )
        suggested_qty       = max(eoq, math.ceil(avg_daily * lead_time * 2))

        reasoning = await generate_reorder_reasoning(
            item={
                "name":          stock["item_name"],
                "sku":           stock["sku"],
                "reorder_point": reorder_point,
                "unit_cost":     unit_cost,
            },
            stock={
                "stock_qty":   current_qty,
                "branch_name": stock["branch_name"],
            },
            forecast={
                "predicted_demand": round(avg_daily * 30, 1),
                "confidence_score": confidence,
            },
            currency=currency,
        )

        recommendations.append({
            "item_id":                   item_id,
            "item_name":                 stock["item_name"],
            "sku":                       stock["sku"],
            "branch_id":                 branch_id,
            "branch_name":               stock["branch_name"],
            "current_stock":             current_qty,
            "reorder_point":             reorder_point,
            "suggested_order_qty":       suggested_qty,
            "estimated_days_until_stockout": (
                round(days_until_stockout, 1) if days_until_stockout is not None else None
            ),
            "avg_daily_demand":          round(avg_daily, 2),
            "lead_time_days":            round(lead_time, 1),
            "priority":                  _priority(days_until_stockout),
            "confidence_score":          round(confidence, 2),
            "reasoning":                 reasoning,
        })

    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    recommendations.sort(key=lambda r: priority_order.get(r["priority"], 4))
    return recommendations

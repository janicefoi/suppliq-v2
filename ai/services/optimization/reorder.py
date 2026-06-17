"""
Reorder Point Optimisation Service

What this will do:
  1. For every (item, branch) combination:
       a. Get current stock from branch_stocks
       b. Get demand forecast for the next 30 days
       c. Estimate lead time from PO history for that item's supplier
       d. Calculate:
            - Reorder Point (ROP) = avg daily demand × lead time + safety stock
            - Safety stock = Z × σ_demand × √lead_time  (Z=1.65 for 95% service level)
            - Economic Order Quantity (EOQ) = √(2DS/H)
               D = annual demand, S = order cost (est. 50 currency units), H = holding cost (est. 20% of item cost)
  2. Flag items where current_stock ≤ ROP as "needs reorder"
  3. Estimate days until stockout = current_stock / avg_daily_demand
  4. Generate reorder recommendation with Claude reasoning
  5. Write suggested_qty back to the forecasts table

Priority levels:
  critical  - stockout in ≤3 days
  high      - stockout in 4-7 days OR stock already 0
  medium    - stockout in 8-14 days
  low       - below ROP but >14 days of cover

Phase 2:
  - Use actual supplier lead times from PO history (not estimates)
  - Add MOQ (minimum order quantity) constraints per supplier
  - Bundle recommendations into suggested purchase orders
  - Account for pending purchase orders already in-flight
"""

import math
from datetime import datetime

from utils.db import get_branch_stock, get_purchase_order_history, get_org_details
from utils.llm import generate_reorder_reasoning


DEFAULT_LEAD_TIME_DAYS = 5     # assumed if no PO history
ORDER_COST_RATIO = 0.02        # estimated admin cost per order = 2% of unit cost (currency-agnostic)
HOLDING_COST_PCT = 0.20        # 20% of unit cost per year
SERVICE_LEVEL_Z = 1.65         # 95% service level


def _estimate_lead_time(orders: list[dict], item_id: str) -> float:
    """Estimate avg lead time in days for an item from its PO history."""
    item_orders = [
        o for o in orders
        if o["item_id"] == item_id
        and o.get("delivered_at") and o.get("created_at")
    ]
    if not item_orders:
        return DEFAULT_LEAD_TIME_DAYS
    lead_times = [
        (o["delivered_at"] - o["created_at"]).days
        for o in item_orders
        if (o["delivered_at"] - o["created_at"]).days >= 0
    ]
    return sum(lead_times) / len(lead_times) if lead_times else DEFAULT_LEAD_TIME_DAYS


def _calculate_eoq(annual_demand: float, unit_cost: float) -> int:
    """Economic Order Quantity formula. ORDER_COST derived as ratio of unit_cost so it's currency-agnostic."""
    if annual_demand <= 0 or unit_cost <= 0:
        return 0
    order_cost = max(unit_cost * ORDER_COST_RATIO, 1.0)
    H = unit_cost * HOLDING_COST_PCT
    eoq = math.sqrt((2 * annual_demand * order_cost) / H)
    return max(1, round(eoq))


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


async def get_reorder_recommendations(org_id: str) -> list[dict]:
    """
    Returns reorder recommendations sorted by priority (critical first).
    Each recommendation includes Claude-generated reasoning.
    """
    org = await get_org_details(org_id)
    currency = org["currency"] if org else "EUR"

    stocks = await get_branch_stock(org_id)
    orders = await get_purchase_order_history(org_id, days=180)

    # Build a quick lookup of forecast demand per (item_id, branch_id)
    # In production this reads from the forecasts table; here we use a simple
    # daily average from the stock data as a placeholder.
    # TODO: JOIN against forecasts table for proper demand data

    recommendations = []

    for stock in stocks:
        item_id = stock["item_id"]
        current_qty = stock["stock_qty"]
        reorder_point = stock.get("low_stock_threshold", 5)
        unit_cost = float(stock.get("wholesale_price", stock.get("retail_price", 0))) * 0.7

        lead_time = _estimate_lead_time(orders, item_id)

        # Rough daily demand estimate: use 2% of reorder_point as placeholder
        # Will be replaced with actual forecast data in Phase 2
        avg_daily_demand = max(0.5, reorder_point * 0.15)

        if avg_daily_demand > 0:
            days_until_stockout = current_qty / avg_daily_demand
        else:
            days_until_stockout = None

        # Only surface items at or below reorder point
        if current_qty > reorder_point:
            continue

        annual_demand = avg_daily_demand * 365
        eoq = _calculate_eoq(annual_demand, unit_cost)
        suggested_qty = max(eoq, reorder_point * 2)  # at least 2× reorder point

        # Claude reasoning
        reasoning = await generate_reorder_reasoning(
            item={"name": stock["item_name"], "sku": stock["sku"], "reorder_point": reorder_point, "unit_cost": unit_cost},
            stock={"stock_qty": current_qty, "branch_name": stock["branch_name"]},
            forecast={"predicted_demand": round(avg_daily_demand * 30, 1), "confidence_score": 0.6},
            currency=currency,
        )

        recommendations.append({
            "item_id": item_id,
            "item_name": stock["item_name"],
            "sku": stock["sku"],
            "branch_id": stock["branch_id"],
            "branch_name": stock["branch_name"],
            "current_stock": current_qty,
            "reorder_point": reorder_point,
            "suggested_order_qty": suggested_qty,
            "estimated_days_until_stockout": round(days_until_stockout, 1) if days_until_stockout else None,
            "priority": _priority(days_until_stockout),
            "reasoning": reasoning,
        })

    # Sort: critical → high → medium → low
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    recommendations.sort(key=lambda r: priority_order.get(r["priority"], 4))
    return recommendations

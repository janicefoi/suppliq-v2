"""
Overstock Detection Service

Flags items where current_stock > (avg_daily_demand × 60).

For each overstocked item:
  - days_of_cover  : current_stock / avg_daily_demand
  - excess_units   : units above the 60-day threshold
  - capital_tied   : excess_units × unit_cost (in org currency)
  - turnover_rate  : annual turns = 365 / days_of_cover
  - severity       : severe (>120d) / high (>90d) / medium (>60d)
  - markdown_suggestion : discount % and suggested retail price
  - transfer_suggestion : nearest branch where same item is below its ROP

Requires fresh demand forecasts (<48 h).  Items with no forecast are skipped.
"""

import asyncio

from utils.db import get_branch_stock, get_latest_forecasts_by_item_branch, get_org_details

COVER_DAYS_THRESHOLD  = 60    # days of cover above which an item is "overstocked"
MIN_DAILY_DEMAND      = 0.05  # skip items with effectively zero demand


def _severity(days: float) -> str:
    if days > 120: return "severe"
    if days > 90:  return "high"
    return "medium"


def _markdown_pct(days: float) -> int:
    """Discount deep enough to normalise days of cover back toward 60 days."""
    if days > 120: return 20
    if days > 90:  return 15
    return 10


async def get_overstock_analysis(org_id: str) -> dict:
    """
    Returns all overstocked items sorted by capital_tied DESC.

    Response keys:
        organization_id, currency, overstock_items, count,
        severe_count, high_count, total_capital_tied
    """
    org, stocks, forecasts = await asyncio.gather(
        get_org_details(org_id),
        get_branch_stock(org_id),
        get_latest_forecasts_by_item_branch(org_id),
    )
    currency = org["currency"] if org else "EUR"

    # Index for O(1) cross-branch lookup
    stock_index: dict[tuple[str, str], dict] = {
        (s["item_id"], s["branch_id"]): s for s in stocks
    }
    item_to_branches: dict[str, list[str]] = {}
    for s in stocks:
        item_to_branches.setdefault(s["item_id"], []).append(s["branch_id"])

    overstock_items = []

    for stock in stocks:
        item_id   = stock["item_id"]
        branch_id = stock["branch_id"]
        qty       = stock["stock_qty"]

        demand_data = forecasts.get((item_id, branch_id))
        if not demand_data:
            continue  # no fresh forecast — can't judge cover

        avg_daily  = demand_data["avg_daily_demand"]
        confidence = demand_data["confidence_score"]

        if avg_daily < MIN_DAILY_DEMAND:
            continue  # effectively zero demand; days_of_cover would be meaningless

        threshold = avg_daily * COVER_DAYS_THRESHOLD
        if qty <= threshold:
            continue  # healthy stock level

        retail_price    = float(stock.get("retail_price") or 0)
        wholesale_price = float(stock.get("wholesale_price") or 0)
        unit_cost       = wholesale_price if wholesale_price > 0 else retail_price * 0.6

        days_of_cover  = qty / avg_daily
        excess_units   = max(0, int(qty - threshold))
        capital_tied   = round(excess_units * unit_cost, 2)
        turnover_rate  = round(365 / days_of_cover, 2)

        disc_pct = _markdown_pct(days_of_cover)
        markdown = {
            "discount_pct":    disc_pct,
            "current_price":   round(retail_price, 2),
            "suggested_price": round(retail_price * (1 - disc_pct / 100), 2),
        }

        # Find the best transfer target: a branch that has the same item below its ROP
        transfer = None
        for other_bid in item_to_branches.get(item_id, []):
            if other_bid == branch_id:
                continue
            dest = stock_index.get((item_id, other_bid))
            if dest is None:
                continue
            dest_qty = dest["stock_qty"]
            dest_rop = dest.get("low_stock_threshold") or 2
            if dest_qty < dest_rop:
                # Send enough to cover 7 days of demand at the destination
                buffer    = max(2, int(avg_daily * 7))
                send_qty  = min(excess_units, max(1, dest_rop - dest_qty + buffer))
                dest_days = round(dest_qty / avg_daily, 1) if avg_daily > 0 else None
                transfer  = {
                    "to_branch_id":       other_bid,
                    "to_branch_name":     dest["branch_name"],
                    "transfer_qty":       send_qty,
                    "dest_current_stock": dest_qty,
                    "dest_days_of_cover": dest_days,
                }
                break  # one suggestion is enough

        overstock_items.append({
            "item_id":           item_id,
            "item_name":         stock["item_name"],
            "sku":               stock["sku"],
            "branch_id":         branch_id,
            "branch_name":       stock["branch_name"],
            "current_stock":     qty,
            "avg_daily_demand":  round(avg_daily, 2),
            "days_of_cover":     round(days_of_cover, 1),
            "excess_units":      excess_units,
            "capital_tied":      capital_tied,
            "unit_cost":         round(unit_cost, 2),
            "retail_price":      round(retail_price, 2),
            "turnover_rate":     turnover_rate,
            "severity":          _severity(days_of_cover),
            "confidence_score":  round(confidence, 2),
            "markdown_suggestion": markdown,
            "transfer_suggestion": transfer,
        })

    overstock_items.sort(key=lambda x: x["capital_tied"], reverse=True)

    return {
        "organization_id":   org_id,
        "currency":          currency,
        "overstock_items":   overstock_items,
        "count":             len(overstock_items),
        "severe_count":      sum(1 for x in overstock_items if x["severity"] == "severe"),
        "high_count":        sum(1 for x in overstock_items if x["severity"] == "high"),
        "total_capital_tied": round(sum(x["capital_tied"] for x in overstock_items), 2),
    }

"""
Inter-Branch Transfer Recommendation Service

Finds specific branch-to-branch transfer opportunities where:
  - Source has > SOURCE_MIN_COVER_DAYS of stock (any meaningful excess)
  - Destination is at risk (below ROP or < DEST_RISK_DAYS cover)

For each matched pair:
  - Calculates the optimal transfer quantity
  - Quantifies two benefits: capital freed at source + emergency reorder avoided at destination
  - Assigns priority based on destination urgency

Lower source threshold (30d) vs overstock detection (60d) surfaces more
opportunities — a branch with 35d cover can share with one that has 3d cover
even though neither is technically "overstocked."

Each (item_id, dest_branch_id) pair yields at most one recommendation:
the source with the most excess is always preferred.
"""

import asyncio
from utils.db import get_branch_stock, get_latest_forecasts_by_item_branch, get_org_details

SOURCE_MIN_COVER_DAYS  = 30    # source must have > this to contribute
SOURCE_SAFE_COVER_DAYS = 21    # keep at least this many days at source after transfer
TARGET_DEST_COVER_DAYS = 30    # try to bring destination to this many days
DEST_RISK_DAYS         = 14    # destination is a candidate if cover < this (or below ROP)
RUSH_PREMIUM           = 0.15  # approx 15% premium for an emergency/rush reorder
MIN_DAILY_DEMAND       = 0.05  # skip items with effectively zero demand


def _priority(dest_days: float | None, dest_stock: int, dest_rop: int) -> str:
    if dest_stock == 0 or (dest_days is not None and dest_days <= 3):
        return "critical"
    if dest_stock < dest_rop or (dest_days is not None and dest_days <= 7):
        return "high"
    return "medium"


def _priority_order(p: str) -> int:
    return {"critical": 0, "high": 1, "medium": 2}.get(p, 3)


async def get_transfer_recommendations(org_id: str) -> dict:
    """
    Returns all inter-branch transfer recommendations sorted by urgency.

    Response keys:
        organization_id, currency, recommendations, count,
        critical_count, high_count, total_capital_freed, total_reorder_savings
    """
    org, stocks, forecasts = await asyncio.gather(
        get_org_details(org_id),
        get_branch_stock(org_id),
        get_latest_forecasts_by_item_branch(org_id),
    )
    currency = org["currency"] if org else "EUR"

    # Index all branch stock rows by (item_id, branch_id)
    stock_index: dict[tuple[str, str], dict] = {
        (s["item_id"], s["branch_id"]): s for s in stocks
    }

    # Group branch_ids per item_id
    item_to_branches: dict[str, list[str]] = {}
    for s in stocks:
        item_to_branches.setdefault(s["item_id"], []).append(s["branch_id"])

    # Build recommendations: for each (item, dest) pair, pick the best source
    # best_source[(item_id, dest_branch_id)] = the source row with most excess
    best_source: dict[tuple[str, str], dict] = {}

    for item_id, branch_ids in item_to_branches.items():
        for src_bid in branch_ids:
            src = stock_index[(item_id, src_bid)]
            src_demand = forecasts.get((item_id, src_bid))
            if not src_demand:
                continue
            src_avg = src_demand["avg_daily_demand"]
            if src_avg < MIN_DAILY_DEMAND:
                continue
            src_days = src["stock_qty"] / src_avg
            if src_days <= SOURCE_MIN_COVER_DAYS:
                continue  # source doesn't have enough to share

            # How much the source can safely send
            safe_stock   = int(src_avg * SOURCE_SAFE_COVER_DAYS)
            available    = max(0, src["stock_qty"] - safe_stock)
            if available < 1:
                continue

            for dest_bid in branch_ids:
                if dest_bid == src_bid:
                    continue
                dest = stock_index[(item_id, dest_bid)]
                dest_demand = forecasts.get((item_id, dest_bid))

                # Use same avg demand for destination if no forecast there
                dest_avg = dest_demand["avg_daily_demand"] if dest_demand else src_avg
                dest_days: float | None = (
                    dest["stock_qty"] / dest_avg if dest_avg >= MIN_DAILY_DEMAND else None
                )
                dest_rop = dest.get("low_stock_threshold") or 2

                # Destination must actually need stock
                needs_stock = (
                    dest["stock_qty"] < dest_rop
                    or (dest_days is not None and dest_days < DEST_RISK_DAYS)
                )
                if not needs_stock:
                    continue

                pair_key = (item_id, dest_bid)
                existing = best_source.get(pair_key)
                if existing is None or available > existing["_available"]:
                    best_source[pair_key] = {
                        **src,
                        "_available":   available,
                        "_src_days":    src_days,
                        "_dest":        dest,
                        "_dest_days":   dest_days,
                        "_dest_rop":    dest_rop,
                        "_dest_avg":    dest_avg,
                        "_src_avg":     src_avg,
                        "_src_confidence": src_demand.get("confidence_score", 0.5),
                    }

    recommendations = []

    for (item_id, dest_bid), row in best_source.items():
        dest          = row["_dest"]
        available     = row["_available"]
        dest_days     = row["_dest_days"]
        dest_avg      = row["_dest_avg"]
        src_avg       = row["_src_avg"]
        dest_rop      = row["_dest_rop"]

        # How much to send: bring dest to TARGET_DEST_COVER_DAYS, but cap at available
        needed = max(1, int(dest_avg * TARGET_DEST_COVER_DAYS) - dest["stock_qty"])
        transfer_qty  = min(available, max(1, needed))

        # Unit cost
        retail_price    = float(row.get("retail_price") or 0)
        wholesale_price = float(row.get("wholesale_price") or 0)
        unit_cost       = wholesale_price if wholesale_price > 0 else retail_price * 0.6

        # Benefit 1: capital freed at source (excess units × cost)
        capital_freed = round(transfer_qty * unit_cost, 2)

        # Benefit 2: emergency reorder avoided at destination
        # Approximation: if dest had to emergency-reorder the same qty,
        # they'd pay unit_cost × (1 + RUSH_PREMIUM) × qty vs the transfer cost (near zero)
        reorder_savings = round(transfer_qty * unit_cost * RUSH_PREMIUM, 2)

        priority = _priority(dest_days, dest["stock_qty"], dest_rop)

        recommendations.append({
            "item_id":           item_id,
            "item_name":         row["item_name"],
            "sku":               row["sku"],
            "from_branch_id":    row["branch_id"],
            "from_branch_name":  row["branch_name"],
            "from_stock":        row["stock_qty"],
            "from_days_of_cover": round(row["_src_days"], 1),
            "to_branch_id":      dest_bid,
            "to_branch_name":    dest["branch_name"],
            "to_stock":          dest["stock_qty"],
            "to_days_of_cover":  round(dest_days, 1) if dest_days is not None else None,
            "to_rop":            dest_rop,
            "transfer_qty":      transfer_qty,
            "priority":          priority,
            "unit_cost":         round(unit_cost, 2),
            "retail_price":      round(retail_price, 2),
            "capital_freed":     capital_freed,
            "reorder_savings":   reorder_savings,
            "confidence_score":  round(row["_src_confidence"], 2),
        })

    recommendations.sort(key=lambda r: (
        _priority_order(r["priority"]),
        -r["capital_freed"],
    ))

    total_capital  = round(sum(r["capital_freed"]   for r in recommendations), 2)
    total_savings  = round(sum(r["reorder_savings"] for r in recommendations), 2)

    return {
        "organization_id":     org_id,
        "currency":            currency,
        "recommendations":     recommendations,
        "count":               len(recommendations),
        "critical_count":      sum(1 for r in recommendations if r["priority"] == "critical"),
        "high_count":          sum(1 for r in recommendations if r["priority"] == "high"),
        "total_capital_freed": total_capital,
        "total_reorder_savings": total_savings,
    }

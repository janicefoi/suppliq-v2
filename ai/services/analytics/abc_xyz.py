"""
ABC / XYZ Inventory Classification Service

ABC — by cumulative revenue contribution (Pareto):
  A : top items whose cumulative revenue reaches 80%   (~20% of SKUs)
  B : next band reaching 95%                            (~30% of SKUs)
  C : remaining items                                   (~50% of SKUs)

XYZ — by demand variability (coefficient of variation = std / mean):
  X : CV < 0.5    stable, predictable demand
  Y : 0.5 ≤ CV < 1.0   moderate variability
  Z : CV ≥ 1.0   highly variable / sporadic

Combined class (AX … CZ) drives stock strategy:
  AX  high revenue + stable       → maintain stock, safety buffer
  AZ  high revenue + variable     → critical attention, extra buffer
  CZ  low revenue + variable      → review for discontinuation

Requires at least MIN_WEEKS_FOR_XYZ weeks of sales data for reliable CV;
items with fewer weeks are classified Z (conservative: treat as variable).
"""

import asyncio

from utils.db import (
    get_items_for_org,
    get_item_revenue,
    get_item_weekly_variability,
    get_branch_stock,
    get_org_details,
)

# ── Thresholds ─────────────────────────────────────────────────────────────

ABC_A_THRESHOLD = 80.0   # cumulative revenue % up to A/B boundary
ABC_B_THRESHOLD = 95.0   # cumulative revenue % up to B/C boundary
CV_X_THRESHOLD  = 0.5    # CV below this → X (stable)
CV_Y_THRESHOLD  = 1.0    # CV below this → Y (moderate), else Z
MIN_WEEKS_FOR_XYZ = 3    # need at least this many weeks for a reliable CV


# ── Recommendation text per combined class ─────────────────────────────────

CLASS_ACTION = {
    "AX": "Prioritise — high value, predictable. Maintain safety stock.",
    "AY": "Monitor closely — high value but variable. Buffer stock recommended.",
    "AZ": "Critical attention — high value and unpredictable. Review supply chain.",
    "BX": "Standard management — steady demand, moderate value.",
    "BY": "Review periodically — moderate value and variability.",
    "BZ": "Consider rationalisation — moderate value, erratic demand.",
    "CX": "Streamline — low value but stable. Lean stock policy.",
    "CY": "Review for reduction — low value and some variability.",
    "CZ": "Discontinue candidate — low revenue and highly variable demand.",
}

CLASS_COLOURS = {
    "AX": "#22c55e",  "AY": "#10b981",  "AZ": "#f59e0b",
    "BX": "#38bdf8",  "BY": "#64748b",  "BZ": "#f97316",
    "CX": "#a3e635",  "CY": "#facc15",  "CZ": "#ef4444",
}


def _xyz(avg_weekly: float, std_weekly: float, week_count: int) -> tuple[str, float]:
    """Returns (class, cv)."""
    if avg_weekly <= 0 or week_count < MIN_WEEKS_FOR_XYZ:
        return "Z", 0.0
    cv = std_weekly / avg_weekly
    if cv < CV_X_THRESHOLD:   return "X", round(cv, 3)
    if cv < CV_Y_THRESHOLD:   return "Y", round(cv, 3)
    return "Z", round(cv, 3)


async def get_abc_xyz_analysis(org_id: str, days: int = 180) -> dict:
    """
    Full ABC/XYZ classification for all active items in an org.

    Returns:
        organization_id, currency, period_days,
        items          — list of classified item dicts (revenue-sorted, A first)
        matrix         — {class_key: {count, revenue}} for the 3×3 grid
        total_revenue, item_count,
        class_counts   — {A, B, C} and {X, Y, Z} tallies
    """
    (org, all_items, revenue_map, variability_map, stocks) = await asyncio.gather(
        get_org_details(org_id),
        get_items_for_org(org_id),
        get_item_revenue(org_id, days=days),
        get_item_weekly_variability(org_id, days=days),
        get_branch_stock(org_id),
    )
    currency = org["currency"] if org else "EUR"

    # Aggregate stock per item across all branches
    stock_totals: dict[str, dict] = {}
    for s in stocks:
        iid = s["item_id"]
        if iid not in stock_totals:
            stock_totals[iid] = {"stock_qty": 0, "stock_value": 0.0}
        stock_totals[iid]["stock_qty"] += s["stock_qty"]
        price = float(s.get("wholesale_price") or s.get("retail_price") or 0)
        stock_totals[iid]["stock_value"] += s["stock_qty"] * price

    # Build unsorted item list
    items = []
    for item in all_items:
        iid        = item["id"]
        rev_data   = revenue_map.get(iid, {"revenue": 0.0, "total_qty_sold": 0})
        var_data   = variability_map.get(iid, {"avg_weekly": 0.0, "std_weekly": 0.0, "week_count": 0})
        stk        = stock_totals.get(iid, {"stock_qty": 0, "stock_value": 0.0})

        xyz_class, cv = _xyz(
            var_data["avg_weekly"],
            var_data["std_weekly"],
            var_data["week_count"],
        )

        items.append({
            "item_id":          iid,
            "item_name":        item["name"],
            "sku":              item["sku"],
            "category":         item.get("category") or "Uncategorised",
            "revenue":          round(rev_data["revenue"], 2),
            "total_qty_sold":   rev_data["total_qty_sold"],
            "avg_weekly_demand": round(var_data["avg_weekly"], 2),
            "cv":               cv,
            "week_count":       var_data["week_count"],
            "xyz_class":        xyz_class,
            "stock_qty":        stk["stock_qty"],
            "stock_value":      round(stk["stock_value"], 2),
            # ABC fields set below after sorting
            "abc_class":            "",
            "combined_class":       "",
            "revenue_pct":          0.0,
            "cumulative_revenue_pct": 0.0,
            "rank":                 0,
        })

    # ── ABC classification ─────────────────────────────────────────────────
    items.sort(key=lambda x: x["revenue"], reverse=True)
    total_revenue = sum(x["revenue"] for x in items)

    cumulative = 0.0
    for rank, item in enumerate(items, start=1):
        item["rank"] = rank
        revenue_pct = (item["revenue"] / total_revenue * 100) if total_revenue > 0 else 0.0
        cumulative += item["revenue"]
        cum_pct = (cumulative / total_revenue * 100) if total_revenue > 0 else 100.0

        item["revenue_pct"]          = round(revenue_pct, 3)
        item["cumulative_revenue_pct"] = round(cum_pct, 2)

        if item["revenue"] == 0:
            item["abc_class"] = "C"
        elif cum_pct <= ABC_A_THRESHOLD:
            item["abc_class"] = "A"
        elif cum_pct <= ABC_B_THRESHOLD:
            item["abc_class"] = "B"
        else:
            item["abc_class"] = "C"

        item["combined_class"]  = item["abc_class"] + item["xyz_class"]
        item["action"]          = CLASS_ACTION.get(item["combined_class"], "")
        item["colour"]          = CLASS_COLOURS.get(item["combined_class"], "#64748b")

    # ── Matrix summary ─────────────────────────────────────────────────────
    matrix: dict[str, dict] = {k: {"count": 0, "revenue": 0.0} for k in CLASS_ACTION}
    for item in items:
        c = item["combined_class"]
        if c in matrix:
            matrix[c]["count"]   += 1
            matrix[c]["revenue"] += item["revenue"]

    for v in matrix.values():
        v["revenue"] = round(v["revenue"], 2)

    return {
        "organization_id":  org_id,
        "currency":         currency,
        "period_days":      days,
        "total_revenue":    round(total_revenue, 2),
        "item_count":       len(items),
        "items":            items,
        "matrix":           matrix,
        "class_counts": {
            "A": sum(1 for x in items if x["abc_class"] == "A"),
            "B": sum(1 for x in items if x["abc_class"] == "B"),
            "C": sum(1 for x in items if x["abc_class"] == "C"),
            "X": sum(1 for x in items if x["xyz_class"] == "X"),
            "Y": sum(1 for x in items if x["xyz_class"] == "Y"),
            "Z": sum(1 for x in items if x["xyz_class"] == "Z"),
        },
    }

"""
Cash Flow Forecasting Service (30-day)

Three revenue/cost sources combined into a forward-looking projection:

  1. PROJECTED REVENUE — demand forecasts × retail price per (item, branch).
     Falls back to last-30-day rolling average if no forecasts exist yet.

  2. EXPENSE RUN RATE — last 30-day actuals per category, used as-is.
     Assumes spending continues at the same rate (conservative estimate).

  3. PURCHASE COMMITMENTS — for every (item, branch) where stock_qty is at or
     below the reorder point, estimate the cost of restocking to 2×ROP.
     Uses wholesale_price; items without a price are excluded.

Output:
  projected_revenue_30d   — total revenue expected over 30 days
  projected_expenses_30d  — expected recurring expenses
  projected_purchases_30d — estimated reorder spend
  net_cash_30d            — revenue - expenses - purchases
  commentary              — Claude CFO narrative (3 sentences)
  revenue_method          — "forecast" | "rolling_avg"
  forecast_confidence     — avg confidence score (0-1) if forecasts used
  expense_breakdown       — per-category list
  purchase_breakdown      — per-item list of items below ROP
  daily_timeline          — 30-element list for the chart
                            [{day, date, revenue, expenses, purchases, net, cumulative}]
"""

import asyncio
from datetime import date, timedelta, timezone, datetime

from utils.db import (
    get_org_details,
    get_items_for_org,
    get_branch_stock,
    get_branch_names,
    get_latest_forecasts_by_item_branch,
    get_daily_revenue_agg,
    get_expense_summary,
)
from utils.llm import generate_cash_flow_commentary


# ── Revenue projection ──────────────────────────────────────────────────────

def _project_revenue_from_forecasts(
    forecasts: dict[tuple[str, str], dict],
    item_prices: dict[str, float],
) -> tuple[float, float]:
    """
    Returns (projected_revenue_30d, avg_confidence).
    projected_revenue_30d = SUM(predicted_demand × retail_price) per (item, branch).
    """
    total   = 0.0
    weights = []
    for (item_id, _branch_id), fc in forecasts.items():
        price = item_prices.get(item_id, 0.0)
        if price <= 0:
            continue
        total += float(fc["predicted_demand"]) * price
        weights.append(float(fc["confidence_score"]))
    confidence = sum(weights) / len(weights) if weights else 0.0
    return round(total, 2), round(confidence, 3)


# ── Purchase commitment estimate ────────────────────────────────────────────

def _estimate_purchases(
    stocks: list[dict],
    branch_names: dict[str, str],
) -> tuple[float, list[dict]]:
    """
    For each (item, branch) at or below the reorder point, estimate cost of
    restocking to 2×ROP.
    Returns (total_cost, breakdown_list).
    """
    total     = 0.0
    breakdown = []

    for s in stocks:
        rop       = int(s.get("low_stock_threshold") or 0)
        stock_qty = int(s.get("stock_qty") or 0)
        if rop <= 0 or stock_qty > rop:
            continue

        unit_cost = float(s.get("wholesale_price") or 0)
        if unit_cost <= 0:
            continue

        est_order_qty = max(rop * 2 - stock_qty, rop)
        est_cost      = round(est_order_qty * unit_cost, 2)
        total        += est_cost

        breakdown.append({
            "item_id":      str(s["item_id"]),
            "item_name":    s["item_name"],
            "sku":          s["sku"],
            "branch_name":  branch_names.get(str(s["branch_id"]), ""),
            "stock_qty":    stock_qty,
            "reorder_point": rop,
            "est_order_qty": est_order_qty,
            "unit_cost":    unit_cost,
            "est_total_cost": est_cost,
        })

    breakdown.sort(key=lambda x: -x["est_total_cost"])
    return round(total, 2), breakdown


# ── Daily timeline ──────────────────────────────────────────────────────────

def _build_daily_timeline(
    projected_revenue:  float,
    projected_expenses: float,
    projected_purchases: float,
) -> list[dict]:
    """
    Spreads the 30-day totals into a per-day timeline for the chart.
    Revenue and expenses are spread evenly.
    Purchase commitments are front-loaded into the first 7 days (cash leaves
    soon after a reorder is placed).
    """
    today              = date.today()
    daily_rev          = projected_revenue  / 30
    daily_exp          = projected_expenses / 30
    daily_pur_early    = projected_purchases / 7   # first 7 days
    cumulative         = 0.0
    timeline           = []

    for i in range(30):
        day_num  = i + 1
        day_date = (today + timedelta(days=day_num)).isoformat()
        purchases = daily_pur_early if i < 7 else 0.0
        net       = daily_rev - daily_exp - purchases
        cumulative += net
        timeline.append({
            "day":        day_num,
            "date":       day_date,
            "revenue":    round(daily_rev, 2),
            "expenses":   round(daily_exp, 2),
            "purchases":  round(purchases, 2),
            "net":        round(net, 2),
            "cumulative": round(cumulative, 2),
        })

    return timeline


# ── Public API ─────────────────────────────────────────────────────────────

async def run_cash_flow_forecast(org_id: str) -> dict:
    """
    Returns a 30-day cash flow projection with Claude commentary.
    All DB queries run in parallel; Claude is called once at the end.
    """
    (
        org,
        items,
        stocks,
        branch_names,
        forecasts,
        revenue_trend,
        expense_rows,
    ) = await asyncio.gather(
        get_org_details(org_id),
        get_items_for_org(org_id),
        get_branch_stock(org_id),
        get_branch_names(org_id),
        get_latest_forecasts_by_item_branch(org_id),
        get_daily_revenue_agg(org_id, days=30),
        get_expense_summary(org_id, days=30),
    )

    currency    = (org or {}).get("currency", "EUR")
    item_prices = {i["id"]: float(i.get("retail_price") or 0) for i in items}

    # ── Revenue ────────────────────────────────────────────────────────────
    if forecasts:
        projected_revenue_30d, forecast_confidence = _project_revenue_from_forecasts(
            forecasts, item_prices
        )
        revenue_method = "forecast"
    else:
        # Fallback: last 30-day actuals are the best estimate we have
        projected_revenue_30d = round(sum(float(r["revenue"]) for r in revenue_trend), 2)
        forecast_confidence   = 0.0
        revenue_method        = "rolling_avg"

    # ── Expenses ───────────────────────────────────────────────────────────
    expense_breakdown = [
        {"category": e["category"], "total": round(float(e["total"]), 2)}
        for e in expense_rows
    ]
    projected_expenses_30d = round(sum(e["total"] for e in expense_breakdown), 2)

    # ── Purchase commitments ────────────────────────────────────────────────
    projected_purchases_30d, purchase_breakdown = _estimate_purchases(stocks, branch_names)

    # ── Net position ────────────────────────────────────────────────────────
    net_cash_30d = round(
        projected_revenue_30d - projected_expenses_30d - projected_purchases_30d, 2
    )

    # ── Daily timeline ─────────────────────────────────────────────────────
    daily_timeline = _build_daily_timeline(
        projected_revenue_30d,
        projected_expenses_30d,
        projected_purchases_30d,
    )

    # ── Claude commentary ──────────────────────────────────────────────────
    commentary = await generate_cash_flow_commentary(
        revenue_trend=revenue_trend,
        expense_summary=expense_breakdown,
        projected_purchases=projected_purchases_30d,
        projected_revenue_30d=projected_revenue_30d,
        projected_net_30d=net_cash_30d,
        currency=currency,
    )

    return {
        "currency":               currency,
        "projected_revenue_30d":  projected_revenue_30d,
        "projected_expenses_30d": projected_expenses_30d,
        "projected_purchases_30d": projected_purchases_30d,
        "net_cash_30d":           net_cash_30d,
        "revenue_method":         revenue_method,
        "forecast_confidence":    forecast_confidence,
        "commentary":             commentary,
        "expense_breakdown":      expense_breakdown,
        "purchase_breakdown":     purchase_breakdown[:10],  # top 10
        "daily_timeline":         daily_timeline,
        "recent_revenue_days":    len(revenue_trend),
    }

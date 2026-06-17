"""
Weekly AI Briefing Service

Generates a Monday morning digest for each admin, covering:
  1. Top 3 stockout risks  — items with the fewest days of stock remaining
  2. Biggest anomaly       — most severe anomaly detected last week
  3. Supplier to watch     — supplier with the longest avg lead time
  4. Operational recommendation — Claude's single specific action for the week

Claude writes the entire briefing as flowing prose (no tables, no bullets).

The result is stored in the weekly_briefings table (one row per org per week).
The endpoint is idempotent — re-calling it returns the cached briefing unless
`force=True` is passed.
"""

import asyncio
import logging
from datetime import date, timedelta

from utils.db import (
    get_org_details,
    get_branch_stock,
    get_latest_forecasts_by_item_branch,
    get_supplier_lead_times,
    upsert_weekly_briefing,
    get_weekly_briefing,
)
from utils.llm import generate_weekly_briefing_prose
from services.anomaly.detection import detect_anomalies_fast

logger = logging.getLogger(__name__)


def _current_week_start() -> str:
    """Returns the ISO date string (YYYY-MM-DD) for this week's Monday."""
    today = date.today()
    monday = today - timedelta(days=today.weekday())  # weekday() == 0 for Monday
    return monday.isoformat()


def _compute_stockout_risks(
    stocks: list[dict],
    forecasts: dict[tuple[str, str], dict],
    top_n: int = 3,
) -> list[dict]:
    """
    For each (item, branch) with a forecast, compute days_left = stock_qty / avg_daily_demand.
    Returns the top_n items sorted by days_left ascending (most urgent first).
    Only includes items with < 30 days of stock remaining.
    """
    risks = []
    for s in stocks:
        key = (str(s["item_id"]), str(s["branch_id"]))
        fc = forecasts.get(key)
        if not fc:
            continue
        avg_daily = float(fc.get("avg_daily_demand", 0))
        if avg_daily <= 0:
            continue
        days_left = float(s["stock_qty"]) / avg_daily
        if days_left >= 30:
            continue
        risks.append({
            "item_name": s["item_name"],
            "sku":       s.get("sku", ""),
            "branch":    s.get("branch_name", ""),
            "days_left": round(days_left, 1),
            "stock_qty": int(s["stock_qty"]),
        })

    risks.sort(key=lambda x: x["days_left"])
    return risks[:top_n]


async def generate_briefing_for_org(org_id: str, force: bool = False) -> dict:
    """
    Returns the weekly briefing for an org.
    - Checks for a cached briefing first (unless force=True).
    - Generates and stores a new one if missing or forced.
    """
    week_start = _current_week_start()

    if not force:
        cached = await get_weekly_briefing(org_id, week_start)
        if cached:
            return _format_response(cached, week_start, from_cache=True)

    # ── Gather all data in parallel ───────────────────────────────────────────
    org, stocks, forecasts, lead_times, anomaly_fast = await asyncio.gather(
        get_org_details(org_id),
        get_branch_stock(org_id),
        get_latest_forecasts_by_item_branch(org_id),
        get_supplier_lead_times(org_id, limit=1),
        detect_anomalies_fast(org_id),
    )

    currency  = (org or {}).get("currency", "EUR")
    org_name  = (org or {}).get("name", "Your Organisation")

    # ── Stockout risks ────────────────────────────────────────────────────────
    stockout_risks = _compute_stockout_risks(stocks, forecasts)

    # ── Biggest anomaly ───────────────────────────────────────────────────────
    biggest_anomaly: dict | None = None
    if anomaly_fast.get("preview"):
        biggest_anomaly = anomaly_fast["preview"][0]

    # ── Supplier to watch ─────────────────────────────────────────────────────
    supplier_watch: dict | None = lead_times[0] if lead_times else None

    # ── Claude prose ──────────────────────────────────────────────────────────
    logger.info("Generating weekly briefing for org %s (week %s)", org_id, week_start)
    result = await generate_weekly_briefing_prose(
        org_name=org_name,
        week_start=week_start,
        stockout_risks=stockout_risks,
        biggest_anomaly=biggest_anomaly,
        supplier_to_watch=supplier_watch,
        currency=currency,
    )

    prose          = result["prose"]
    recommendation = result["recommendation"]

    # ── Persist ───────────────────────────────────────────────────────────────
    await upsert_weekly_briefing(
        org_id=org_id,
        week_start=week_start,
        prose=prose,
        stockout_risks=stockout_risks,
        biggest_anomaly=biggest_anomaly,
        supplier_watch=supplier_watch,
        recommendation=recommendation,
    )
    logger.info("Briefing saved for org %s week %s", org_id, week_start)

    return {
        "org_id":         org_id,
        "week_start":     week_start,
        "prose":          prose,
        "recommendation": recommendation,
        "stockout_risks": stockout_risks,
        "biggest_anomaly": biggest_anomaly,
        "supplier_watch":  supplier_watch,
        "currency":        currency,
        "from_cache":      False,
        "generated_at":    None,
    }


def _format_response(row: dict, week_start: str, from_cache: bool) -> dict:
    return {
        "org_id":          row["organizationId"],
        "week_start":      week_start,
        "prose":           row["prose"],
        "recommendation":  row["recommendation"],
        "stockout_risks":  row.get("stockoutRisks") or [],
        "biggest_anomaly": row.get("biggestAnomaly"),
        "supplier_watch":  row.get("supplierWatch"),
        "currency":        "EUR",
        "from_cache":      from_cache,
        "generated_at":    row["generatedAt"].isoformat() if row.get("generatedAt") else None,
    }

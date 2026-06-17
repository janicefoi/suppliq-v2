"""
Anomaly Detection Service

What this will do:
  1. Sales anomalies - flag (item, branch) pairs where today's sales
     deviate >2σ from the 30-day rolling mean:
       - Spike: could mean data entry error, promotion not logged, or theft recovery
       - Drop: could mean stock issue, pricing problem, or competitor disruption
  2. Stock discrepancies - items where reported stock and sales-implied stock
     differ significantly (suggests unrecorded shrinkage or data errors)
  3. Unusual expenses - expenses >3× the category's rolling average
  4. High-value single transactions - sales or expenses above a configurable threshold
  5. Inactive-item sales - items marked inactive but still appearing in sales
  6. Customer debt spikes - customers whose outstanding balance grew >50% this week

For each anomaly:
  - Compute severity (info / warning / critical)
  - Call Claude to explain in plain English and suggest an action
  - Return as a list of Anomaly objects

Phase 2:
  - Detect systematic fraud patterns (e.g. same cashier always voids after cash sales)
  - Cross-branch benchmarking (branch suddenly underperforms vs peers)
  - Supplier invoice anomalies (price suddenly 20%+ above market)
"""

from datetime import datetime

from utils.db import get_sales_history, get_branch_stock, get_expense_summary, get_org_details
from utils.llm import explain_anomaly


async def detect_anomalies(org_id: str) -> list[dict]:
    """
    Runs all anomaly detectors and returns a unified list sorted by severity.
    """
    org = await get_org_details(org_id)
    currency = org["currency"] if org else "EUR"

    anomalies: list[dict] = []

    anomalies.extend(await _detect_sales_anomalies(org_id, currency))
    anomalies.extend(await _detect_stock_discrepancies(org_id))
    anomalies.extend(await _detect_expense_anomalies(org_id, currency))

    severity_order = {"critical": 0, "warning": 1, "info": 2}
    anomalies.sort(key=lambda a: severity_order.get(a["severity"], 3))
    return anomalies


async def _detect_sales_anomalies(org_id: str, currency: str = "EUR") -> list[dict]:
    """
    Flags (item, branch) with today's qty > mean + 2σ or < mean - 2σ.
    """
    import statistics

    rows = await get_sales_history(org_id, days=31)

    # Group daily qty per (item_id, branch_id)
    series: dict[tuple, list[float]] = {}
    today_qty: dict[tuple, float] = {}
    today_str = datetime.utcnow().date().isoformat()

    for row in rows:
        key = (row["item_id"], row["branch_id"])
        date_str = row["date"].isoformat() if hasattr(row["date"], "isoformat") else str(row["date"])
        qty = float(row["total_qty"])
        if date_str == today_str:
            today_qty[key] = qty
        else:
            series.setdefault(key, []).append(qty)

    anomalies = []
    for key, historical in series.items():
        if len(historical) < 7:
            continue  # not enough history
        today = today_qty.get(key, 0)
        mean = statistics.mean(historical)
        std = statistics.stdev(historical)
        if std == 0:
            continue

        z_score = (today - mean) / std
        if abs(z_score) < 2.0:
            continue

        anomaly_type = "sales_spike" if z_score > 0 else "sales_drop"
        severity = "critical" if abs(z_score) > 3 else "warning"

        explanation = await explain_anomaly(
            anomaly_type,
            f"item {key[0]} at branch {key[1]}",
            {"today": today, "mean": round(mean, 1), "std": round(std, 1), "z_score": round(z_score, 2)},
            currency=currency,
        )

        anomalies.append({
            "type": anomaly_type,
            "severity": severity,
            "entity_type": "item",
            "entity_id": key[0],
            "entity_name": key[0],  # TODO: join item name
            "description": explanation,
            "suggested_action": "Review sales records for this item today.",
            "detected_at": datetime.utcnow().isoformat(),
        })

    return anomalies


async def _detect_stock_discrepancies(org_id: str) -> list[dict]:
    """
    Flags items where stock_qty ≤ 0 but still had sales in the last 7 days.
    (Implies stock was sold but not properly tracked.)
    """
    stocks = await get_branch_stock(org_id)
    zero_stock = {(s["item_id"], s["branch_id"]) for s in stocks if s["stock_qty"] <= 0}

    if not zero_stock:
        return []

    recent_sales = await get_sales_history(org_id, days=7)
    sold_keys = {(r["item_id"], r["branch_id"]) for r in recent_sales}

    anomalies = []
    for key in zero_stock & sold_keys:
        anomalies.append({
            "type": "stock_discrepancy",
            "severity": "warning",
            "entity_type": "item",
            "entity_id": key[0],
            "entity_name": key[0],
            "description": "Item has zero or negative stock but recorded sales in the last 7 days. "
                           "This may indicate unrecorded stock movement or a data entry error.",
            "suggested_action": "Perform a physical stock count and reconcile.",
            "detected_at": datetime.utcnow().isoformat(),
        })

    return anomalies


async def _detect_expense_anomalies(org_id: str, currency: str = "EUR") -> list[dict]:
    """
    Flags expense categories where this month's total > 3× 3-month average.
    """
    recent = await get_expense_summary(org_id, days=30)
    historical = await get_expense_summary(org_id, days=90)

    hist_by_cat = {e["category"]: float(e["total"]) for e in historical}
    anomalies = []

    for e in recent:
        cat = e["category"]
        recent_total = float(e["total"])
        hist_total = hist_by_cat.get(cat, 0)
        monthly_avg = hist_total / 3 if hist_total > 0 else 0

        if monthly_avg > 0 and recent_total > monthly_avg * 3:
            anomalies.append({
                "type": "unusual_expense",
                "severity": "warning",
                "entity_type": "expense",
                "entity_id": cat,
                "entity_name": cat,
                "description": f"{cat} expenses this month ({currency} {recent_total:,.2f}) are "
                               f"{recent_total/monthly_avg:.1f}× the 3-month average "
                               f"({currency} {monthly_avg:,.2f}/month).",
                "suggested_action": "Review individual expense entries for this category.",
                "detected_at": datetime.utcnow().isoformat(),
            })

    return anomalies

"""
Anomaly Detection Service

Three detector types, matching the spec exactly:

1. Sales spike/drop
   An (item, branch) is flagged when its average daily sales in the last 7 days
   is >= 3x (spike) or <= 0.3x (drop) the 30-day baseline rate.
   Requires MIN_BASELINE_SALE_DAYS distinct days with sales in the baseline.

2. Stock shrinkage
   Items where stock decreased via MANUAL_ADJUSTMENT (not a sale or transfer).
   Sourced directly from stock_logs, the immutable audit trail.
   Threshold: net negative >= MIN_SHRINKAGE_UNITS OR value >= MIN_SHRINKAGE_VALUE.

3. Expense outlier
   A category's spend in the last 30 days is >= 2x its monthly average from
   the previous 60 days (days 31-90 ago, normalised to 30 days).

Claude explains each anomaly in plain English and suggests one action.
detect_anomalies_fast() skips Claude and returns counts + preview for the badge.
"""

import asyncio
from collections import defaultdict
from datetime import datetime, timezone

from utils.db import (
    get_items_for_org,
    get_branch_names,
    get_org_details,
    get_sales_history,
    get_stock_shrinkage_logs,
    get_expense_by_period,
)
from utils.llm import explain_anomaly

# ── Thresholds ─────────────────────────────────────────────────────────────

SPIKE_RATIO              = 3.0    # recent / baseline >= this → spike
DROP_RATIO               = 0.3    # recent / baseline <= this → drop
MIN_BASELINE_SALE_DAYS   = 7      # min distinct selling days in the baseline window
EXPENSE_MULTIPLIER       = 2.0    # recent 30d / baseline 30d avg >= this → outlier
MIN_SHRINKAGE_UNITS      = 3      # min absolute unit loss for shrinkage
MIN_SHRINKAGE_VALUE      = 20.0   # min monetary value for shrinkage
MAX_PER_TYPE             = 5      # cap per detector (limits LLM calls)


# ── Data fetch (parallel, shared across detectors) ──────────────────────────

async def _fetch_all(org_id: str) -> dict:
    (
        org,
        items,
        branch_names,
        sales_history,
        shrinkage_logs,
        expense_recent,
        expense_baseline,
    ) = await asyncio.gather(
        get_org_details(org_id),
        get_items_for_org(org_id),
        get_branch_names(org_id),
        get_sales_history(org_id, days=37),
        get_stock_shrinkage_logs(org_id, days=7),
        get_expense_by_period(org_id, start_days_ago=30, end_days_ago=0),
        get_expense_by_period(org_id, start_days_ago=90, end_days_ago=30),
    )
    return {
        "currency":         (org or {}).get("currency", "EUR"),
        "item_name":        {i["id"]: i["name"] for i in items},
        "item_sku":         {i["id"]: i["sku"]  for i in items},
        "branch_names":     branch_names,
        "sales_history":    sales_history,
        "shrinkage_logs":   shrinkage_logs,
        "expense_recent":   expense_recent,
        "expense_baseline": expense_baseline,
    }


# ── Sales spike / drop detector ────────────────────────────────────────────

def _detect_sales_raw(data: dict) -> list[dict]:
    today = datetime.now(timezone.utc).date()

    recent_qty:    dict[tuple, float] = defaultdict(float)
    baseline_qty:  dict[tuple, float] = defaultdict(float)
    baseline_days: dict[tuple, set]   = defaultdict(set)

    for row in data["sales_history"]:
        iid   = str(row["item_id"])
        bid   = str(row["branch_id"])
        key   = (iid, bid)
        delta = (today - row["date"]).days
        qty   = float(row["total_qty"])

        if delta <= 7:
            recent_qty[key]  += qty
        else:
            baseline_qty[key] += qty
            baseline_days[key].add(row["date"])

    item_name    = data["item_name"]
    item_sku     = data["item_sku"]
    branch_names = data["branch_names"]
    anomalies    = []

    for key, base_total in baseline_qty.items():
        if len(baseline_days[key]) < MIN_BASELINE_SALE_DAYS:
            continue
        if base_total <= 0:
            continue

        iid, bid     = key
        baseline_rate = base_total / 30
        recent_rate  = recent_qty.get(key, 0.0) / 7
        ratio        = recent_rate / baseline_rate

        if ratio >= SPIKE_RATIO:
            atype = "sales_spike"
        elif ratio <= DROP_RATIO:
            atype = "sales_drop"
        else:
            continue

        severity = "critical" if (ratio >= 5.0 or ratio <= 0.1) else "warning"
        anomalies.append({
            "type":         atype,
            "severity":     severity,
            "entity_type":  "item",
            "entity_id":    iid,
            "entity_name":  item_name.get(iid, iid),
            "sku":          item_sku.get(iid),
            "branch_id":    bid,
            "branch_name":  branch_names.get(bid, bid),
            "_data": {
                "recent_7d_qty":      round(recent_qty.get(key, 0), 1),
                "recent_daily_rate":  round(recent_rate, 2),
                "baseline_daily_rate": round(baseline_rate, 2),
                "ratio":              round(ratio, 2),
            },
            "_sort_key": abs(ratio - 1),
        })

    anomalies.sort(key=lambda a: -a["_sort_key"])
    return anomalies[:MAX_PER_TYPE]


# ── Stock shrinkage detector ───────────────────────────────────────────────

def _detect_shrinkage_raw(data: dict) -> list[dict]:
    anomalies = []
    for row in data["shrinkage_logs"]:
        unit_cost = float(row.get("unit_cost") or 0)
        net_qty   = abs(int(row["net_qty"]))
        value     = round(net_qty * unit_cost, 2)

        if net_qty < MIN_SHRINKAGE_UNITS and value < MIN_SHRINKAGE_VALUE:
            continue

        severity = "critical" if (net_qty >= 20 or value >= 500) else "warning"
        anomalies.append({
            "type":         "stock_shrinkage",
            "severity":     severity,
            "entity_type":  "item",
            "entity_id":    str(row["item_id"]),
            "entity_name":  row["item_name"],
            "sku":          row["sku"],
            "branch_id":    str(row.get("branch_id") or ""),
            "branch_name":  row.get("branch_name") or "Unknown branch",
            "_data": {
                "units_lost":       net_qty,
                "adjustments":      int(row["adjustment_count"]),
                "estimated_value":  value,
                "unit_cost":        unit_cost,
                "currency":         data["currency"],
            },
            "_sort_key": value if value > 0 else net_qty,
        })

    anomalies.sort(key=lambda a: -a["_sort_key"])
    return anomalies[:MAX_PER_TYPE]


# ── Expense outlier detector ────────────────────────────────────────────────

def _detect_expense_raw(data: dict) -> list[dict]:
    anomalies = []

    for category, recent_total in data["expense_recent"].items():
        baseline_60d = data["expense_baseline"].get(category, 0.0)
        baseline_30d = baseline_60d / 2  # normalise 60-day sum → 30-day avg

        if baseline_30d <= 0:
            continue
        ratio = recent_total / baseline_30d
        if ratio < EXPENSE_MULTIPLIER:
            continue

        severity = "critical" if ratio >= 3.5 else "warning"
        anomalies.append({
            "type":         "expense_outlier",
            "severity":     severity,
            "entity_type":  "expense",
            "entity_id":    category,
            "entity_name":  category.replace("_", " ").title(),
            "sku":          None,
            "branch_id":    None,
            "branch_name":  None,
            "_data": {
                "recent_30d":        round(recent_total, 2),
                "baseline_30d_avg":  round(baseline_30d, 2),
                "ratio":             round(ratio, 2),
                "currency":          data["currency"],
            },
            "_sort_key": ratio,
        })

    anomalies.sort(key=lambda a: -a["_sort_key"])
    return anomalies[:MAX_PER_TYPE]


# ── Severity sort ──────────────────────────────────────────────────────────

_SEV = {"critical": 0, "warning": 1}


def _sort_by_severity(anomalies: list[dict]) -> list[dict]:
    return sorted(anomalies, key=lambda a: _SEV.get(a["severity"], 2))


# ── Public API ─────────────────────────────────────────────────────────────

async def detect_anomalies_fast(org_id: str) -> dict:
    """
    Detect anomalies without Claude. Fast (~200ms) — used for the badge count.
    Returns: total, critical, warning counts + a 5-item preview list.
    """
    data    = await _fetch_all(org_id)
    all_raw = _sort_by_severity(
        _detect_sales_raw(data)
        + _detect_shrinkage_raw(data)
        + _detect_expense_raw(data)
    )

    preview = [
        {
            "type":        a["type"],
            "severity":    a["severity"],
            "entity_name": a["entity_name"],
            "branch_name": a.get("branch_name"),
        }
        for a in all_raw[:5]
    ]
    return {
        "total":    len(all_raw),
        "critical": sum(1 for a in all_raw if a["severity"] == "critical"),
        "warning":  sum(1 for a in all_raw if a["severity"] == "warning"),
        "preview":  preview,
    }


async def detect_anomalies(org_id: str) -> list[dict]:
    """
    Detect all anomalies WITH Claude explanations (parallel LLM calls).
    Suitable for the alerts page (~2-5s).
    Returns a list of enriched anomaly dicts sorted by severity.
    """
    data     = await _fetch_all(org_id)
    currency = data["currency"]

    all_raw = _sort_by_severity(
        _detect_sales_raw(data)
        + _detect_shrinkage_raw(data)
        + _detect_expense_raw(data)
    )

    if not all_raw:
        return []

    async def _enrich(a: dict) -> dict:
        entity_label = a["entity_name"]
        if a.get("branch_name"):
            entity_label += f" @ {a['branch_name']}"
        llm = await explain_anomaly(
            anomaly_type=a["type"],
            entity=entity_label,
            data=a["_data"],
            currency=currency,
        )
        return {
            "type":             a["type"],
            "severity":         a["severity"],
            "entity_type":      a["entity_type"],
            "entity_id":        a["entity_id"],
            "entity_name":      a["entity_name"],
            "sku":              a.get("sku"),
            "branch_name":      a.get("branch_name"),
            "description":      llm.get("explanation", ""),
            "suggested_action": llm.get("action", ""),
            "raw_data":         a["_data"],
            "detected_at":      datetime.now(timezone.utc).isoformat(),
        }

    return list(await asyncio.gather(*[_enrich(a) for a in all_raw]))

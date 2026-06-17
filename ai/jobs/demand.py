"""
Nightly demand forecast job.

Fans out across every organisation, runs EMA demand forecasting,
and upserts results into the `forecasts` table. Idempotent — safe
to re-run at any time; existing rows are overwritten in place.
"""

import logging
from datetime import datetime, timezone

from services.forecasting.demand import run_demand_forecast
from utils.db import get_all_org_ids, upsert_forecast

logger = logging.getLogger(__name__)

FORECAST_HORIZON_DAYS = 30


async def run_all_orgs(horizon_days: int = FORECAST_HORIZON_DAYS) -> dict:
    """
    Run demand forecasting for every organisation in the DB.

    Returns a per-org summary:
        { org_id: { "forecasts_written": N, "error": str | None } }
    """
    started_at = datetime.now(timezone.utc)
    org_ids = await get_all_org_ids()

    logger.info(
        "Demand forecast job started — orgs=%d  horizon=%dd",
        len(org_ids),
        horizon_days,
    )

    summary: dict[str, dict] = {}

    for org_id in org_ids:
        try:
            results = await run_demand_forecast(
                org_id=org_id,
                item_id=None,
                branch_id=None,
                horizon_days=horizon_days,
            )
            for r in results:
                await upsert_forecast(r)

            logger.info("  ✓  org=%s  written=%d", org_id, len(results))
            summary[org_id] = {"forecasts_written": len(results), "error": None}

        except Exception as exc:
            logger.error("  ✗  org=%s  error=%s", org_id, exc, exc_info=True)
            summary[org_id] = {"forecasts_written": 0, "error": str(exc)}

    elapsed = (datetime.now(timezone.utc) - started_at).total_seconds()
    total_written = sum(v["forecasts_written"] for v in summary.values())
    failed_orgs   = sum(1 for v in summary.values() if v["error"])

    logger.info(
        "Demand forecast job complete — total_written=%d  failed_orgs=%d  elapsed=%.1fs",
        total_written,
        failed_orgs,
        elapsed,
    )

    return {
        "started_at":     started_at.isoformat(),
        "elapsed_seconds": round(elapsed, 2),
        "orgs_processed": len(org_ids),
        "total_written":  total_written,
        "failed_orgs":    failed_orgs,
        "detail":         summary,
    }

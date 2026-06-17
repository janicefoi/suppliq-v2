from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, HTTPException

from models.schemas import ForecastRequest, ForecastResponse, ForecastResult
from services.forecasting.demand import run_demand_forecast
from services.forecasting.cash_flow import run_cash_flow_forecast
from utils.db import upsert_forecast, get_forecast_summary
from jobs.demand import run_all_orgs

router = APIRouter(prefix="/forecast", tags=["Forecasting"])


@router.post("/demand", response_model=ForecastResponse)
async def demand_forecast(req: ForecastRequest):
    """
    Run demand forecasting for an organisation.

    Reads 90 days of sales history → applies EMA model →
    writes results to the `forecasts` table → returns the forecasts.

    Call this:
      - On a schedule (hourly via the background scheduler)
      - On-demand when a user opens the AI insights dashboard
      - After a large stock-in event (demand baseline may have shifted)
    """
    results = await run_demand_forecast(
        org_id=req.organization_id,
        item_id=req.item_id,
        branch_id=req.branch_id,
        horizon_days=req.horizon_days,
    )

    # Persist to DB
    for r in results:
        await upsert_forecast(r)

    return ForecastResponse(
        organization_id=req.organization_id,
        forecasts=[
            ForecastResult(
                item_id=r["item_id"],
                branch_id=r["branch_id"],
                period_start=r["period_start"],
                period_end=r["period_end"],
                predicted_demand=r["predicted_demand"],
                confidence_score=r["confidence_score"],
                reorder_suggested=r["reorder_suggested"],
                suggested_qty=r.get("suggested_qty"),
                model_version=r["model_version"],
            )
            for r in results
        ],
        generated_at=datetime.utcnow(),
    )


@router.post("/run-all", tags=["Forecasting"])
async def trigger_forecast_all_orgs(
    background_tasks: BackgroundTasks,
    horizon_days: int = 30,
):
    """
    Manually trigger the nightly demand forecast for all organisations.

    Runs in the background — returns immediately with a confirmation.
    Check /forecast/last-run/{org_id} afterward to verify results were written.
    Useful for: testing, post-import refresh, admin dashboard triggers.
    """
    background_tasks.add_task(run_all_orgs, horizon_days=horizon_days)
    return {
        "status": "triggered",
        "horizon_days": horizon_days,
        "message": f"Demand forecast running in background for all orgs ({horizon_days}d horizon)",
    }


@router.get("/last-run/{organization_id}", tags=["Forecasting"])
async def forecast_last_run(organization_id: str):
    """
    Returns a summary of the most recent forecast run for an organisation.
    Use this to verify the nightly job wrote data correctly.
    """
    summary = await get_forecast_summary(organization_id)
    if not summary or not summary.get("last_run_at"):
        return {
            "organization_id": organization_id,
            "has_forecasts": False,
            "message": "No forecasts found — run POST /forecast/run-all to generate the first batch",
        }
    return {
        "organization_id": organization_id,
        "has_forecasts": True,
        **{k: str(v) if v is not None else None for k, v in summary.items()},
    }


@router.get("/cash-flow/{organization_id}", tags=["Forecasting"])
async def cash_flow_forecast(organization_id: str):
    """
    30-day cash flow projection for an organisation.

    Returns: projected revenue, expenses, purchase commitments,
    net cash position, and a Claude-generated CFO commentary.
    """
    result = await run_cash_flow_forecast(org_id=organization_id)
    return result

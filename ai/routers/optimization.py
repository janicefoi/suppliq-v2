from fastapi import APIRouter, BackgroundTasks

from services.optimization.reorder import get_reorder_recommendations, update_reorder_points

router = APIRouter(prefix="/optimize", tags=["Optimization"])


@router.get("/reorder/{organization_id}")
async def reorder_recommendations(organization_id: str):
    """
    Smart reorder recommendations for all items across all branches.

    For each item at or below its reorder point, calculates:
      - Days until stockout (based on avg daily demand)
      - Optimal order quantity (Economic Order Quantity formula)
      - Priority level: critical / high / medium / low
      - Claude-generated plain-English reasoning

    Results are sorted with critical stockouts first.

    The Next.js app displays this in the AI dashboard and can
    optionally pre-fill a purchase order with the suggestions.
    """
    recommendations = await get_reorder_recommendations(org_id=organization_id)
    return {
        "organization_id": organization_id,
        "recommendations": recommendations,
        "count": len(recommendations),
        "critical_count": sum(1 for r in recommendations if r["priority"] == "critical"),
        "high_count": sum(1 for r in recommendations if r["priority"] == "high"),
    }


@router.post("/apply-rop/{organization_id}")
async def apply_reorder_points(organization_id: str, background_tasks: BackgroundTasks):
    """
    Manually trigger ROP recalculation for one organisation.

    Reads the latest demand forecasts (must be < 48 h old) and writes
    AI-calculated thresholds back to branch_stocks.low_stock_threshold.

    The nightly job calls this automatically after demand forecasting,
    so you only need this endpoint to force a refresh mid-day.
    """
    background_tasks.add_task(update_reorder_points, organization_id)
    return {
        "status": "triggered",
        "organization_id": organization_id,
        "message": "ROP recalculation running in background — check branch_stocks.low_stock_threshold in a few seconds",
    }

from fastapi import APIRouter, Query

from services.analytics.abc_xyz import get_abc_xyz_analysis

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/abc-xyz/{organization_id}")
async def abc_xyz_analysis(
    organization_id: str,
    days: int = Query(180, ge=30, le=365, description="Lookback window in days"),
):
    """
    ABC / XYZ inventory classification for all active items.

    ABC — revenue contribution (Pareto):
      A: top items whose cumulative revenue reaches 80%
      B: next band to 95%
      C: remainder

    XYZ — demand variability (coefficient of variation = std / mean):
      X: CV < 0.5   stable
      Y: CV 0.5-1.0 moderate
      Z: CV ≥ 1.0   highly variable

    Returns a per-item list (revenue-sorted) plus a 3×3 matrix summary.
    Use the scatter plot coordinates (cumulative_revenue_pct, cv) to
    render a 2D positioning chart in the frontend.
    """
    result = await get_abc_xyz_analysis(org_id=organization_id, days=days)
    return result

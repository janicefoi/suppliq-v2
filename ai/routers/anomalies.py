from fastapi import APIRouter

from services.anomaly.detection import detect_anomalies, detect_anomalies_fast

router = APIRouter(prefix="/anomalies", tags=["Anomaly Detection"])


@router.get("/{organization_id}/count")
async def anomaly_count(organization_id: str):
    """
    Fast anomaly count + preview without Claude explanations (~200ms).
    Used by the notification badge in the top bar.
    Returns: total, critical, warning counts and a 5-item preview list.
    """
    return await detect_anomalies_fast(org_id=organization_id)


@router.get("/{organization_id}")
async def anomalies(organization_id: str):
    """
    Full anomaly detection with Claude-generated explanations.
    Detectors:
      1. Sales spike/drop — item 3x or 0.3x normal rate in last 7 days
      2. Stock shrinkage  — MANUAL_ADJUSTMENT stock log entries with net negative quantity
      3. Expense outlier  — category spend >= 2x its 30-day baseline average

    Each anomaly includes a plain-English Claude explanation and suggested action.
    Returns sorted by severity (critical first). Expect 2-5s response time.
    """
    found = await detect_anomalies(org_id=organization_id)
    return {
        "organization_id": organization_id,
        "anomalies":       found,
        "count":           len(found),
        "critical_count":  sum(1 for a in found if a["severity"] == "critical"),
        "warning_count":   sum(1 for a in found if a["severity"] == "warning"),
    }

from fastapi import APIRouter

from services.anomaly.detection import detect_anomalies

router = APIRouter(prefix="/anomalies", tags=["Anomaly Detection"])


@router.get("/{organization_id}")
async def anomalies(organization_id: str):
    """
    Detects and returns all anomalies for an organisation.

    Runs three detectors in parallel:
      1. Sales anomalies — unusual spikes or drops (>2σ from 30-day mean)
      2. Stock discrepancies — zero stock but recent sales (implies shrinkage)
      3. Expense anomalies — category spend >3× monthly average

    Each anomaly includes:
      - Severity: critical / warning / info
      - Plain-English description (Claude-generated)
      - Suggested corrective action

    Returns sorted by severity (critical first).
    """
    found = await detect_anomalies(org_id=organization_id)
    return {
        "organization_id": organization_id,
        "anomalies": found,
        "count": len(found),
        "critical_count": sum(1 for a in found if a["severity"] == "critical"),
        "warning_count": sum(1 for a in found if a["severity"] == "warning"),
    }

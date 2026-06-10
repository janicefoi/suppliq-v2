from datetime import datetime

from fastapi import APIRouter

from config import settings
from utils.db import health_check
from utils.llm import is_configured

router = APIRouter()


@router.get("/health", tags=["Health"])
async def health() -> dict:
    """
    Liveness + readiness check.
    Returns 200 if the service is up; individual component flags show degraded state.
    Used by Docker health checks, load balancers, and the Next.js app startup probe.
    """
    db_ok = await health_check()
    claude_ok = is_configured()

    status = "ok"
    if not db_ok or not claude_ok:
        status = "degraded"

    return {
        "status": status,
        "version": settings.app_version,
        "db_connected": db_ok,
        "claude_configured": claude_ok,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


@router.get("/", include_in_schema=False)
async def root():
    return {"service": settings.app_name, "version": settings.app_version, "docs": "/docs"}

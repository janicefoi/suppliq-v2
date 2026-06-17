"""
APScheduler configuration.

One job runs on startup:
  - nightly_demand_forecast  →  02:00 UTC every day

The scheduler is tied to the FastAPI lifespan so it starts and stops
cleanly with the server process. If the server was down at 02:00 and
comes back within an hour, the missed run will still execute
(misfire_grace_time=3600).
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from jobs.demand import run_all_orgs

logger = logging.getLogger(__name__)

_scheduler = AsyncIOScheduler(timezone="UTC")


def init_scheduler() -> None:
    _scheduler.add_job(
        run_all_orgs,
        CronTrigger(hour=2, minute=0, timezone="UTC"),
        id="nightly_demand_forecast",
        name="Nightly demand forecast — all orgs",
        replace_existing=True,
        misfire_grace_time=3600,
        max_instances=1,
    )
    _scheduler.start()
    logger.info("Scheduler started  — nightly demand forecast at 02:00 UTC")


def shutdown_scheduler() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")


def get_scheduler() -> AsyncIOScheduler:
    return _scheduler

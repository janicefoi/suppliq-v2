"""
APScheduler configuration.

Two recurring jobs:
  - nightly_demand_forecast  →  02:00 UTC every day
  - weekly_ai_briefing       →  08:00 UTC every Monday

The scheduler is tied to the FastAPI lifespan so it starts and stops
cleanly with the server process. Missed runs (server was down at trigger
time) will execute within one hour of coming back (misfire_grace_time=3600).
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from jobs.demand import run_all_orgs
from jobs.briefing import run_all_orgs_briefing

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
    _scheduler.add_job(
        run_all_orgs_briefing,
        CronTrigger(day_of_week="mon", hour=8, minute=0, timezone="UTC"),
        id="weekly_ai_briefing",
        name="Weekly AI briefing — all orgs (Monday 08:00 UTC)",
        replace_existing=True,
        misfire_grace_time=3600,
        max_instances=1,
    )
    _scheduler.start()
    logger.info(
        "Scheduler started — nightly forecast 02:00 UTC · weekly briefing Mon 08:00 UTC"
    )


def shutdown_scheduler() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")


def get_scheduler() -> AsyncIOScheduler:
    return _scheduler

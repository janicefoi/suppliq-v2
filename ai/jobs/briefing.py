"""
Weekly briefing job — runs every Monday at 08:00 UTC.

Iterates all active organisations and generates the weekly AI briefing for each.
Briefings are persisted in the weekly_briefings table so the in-app page can
show them without re-generating on every visit.

If a briefing already exists for the current week it is skipped (idempotent),
so the job is safe to re-run manually without overwriting existing content.
"""

import asyncio
import logging

from services.intelligence.briefing import generate_briefing_for_org
from utils.db import get_all_org_ids

logger = logging.getLogger(__name__)


async def run_all_orgs_briefing() -> None:
    """
    Entry point called by the scheduler.
    Generates (or skips if already generated) briefings for all active orgs.
    """
    org_ids = await get_all_org_ids()
    if not org_ids:
        logger.info("No active orgs — nothing to brief")
        return

    logger.info("Weekly briefing job starting for %d org(s)", len(org_ids))
    ok = failed = skipped = 0

    for org_id in org_ids:
        try:
            result = await generate_briefing_for_org(org_id, force=False)
            if result.get("from_cache"):
                skipped += 1
                logger.info("Org %s — briefing already exists, skipped", org_id)
            else:
                ok += 1
                logger.info("Org %s — briefing generated", org_id)
        except Exception:
            failed += 1
            logger.exception("Org %s — briefing generation failed", org_id)
        # Small delay between orgs to avoid hammering the Anthropic API
        await asyncio.sleep(2)

    logger.info(
        "Weekly briefing job done — %d generated, %d skipped, %d failed",
        ok, skipped, failed,
    )

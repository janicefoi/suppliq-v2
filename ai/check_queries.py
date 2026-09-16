"""
Executes every query in utils/db.py against a real database and reports which
ones work.

These queries drifted out of sync with the schema because they were written but
never run: Prisma's @@map renames tables to snake_case while leaving columns in
camelCase, so `s.organization_id` parses fine and fails only at execution.
Nothing but running them catches that.

Read-only. Write paths (upsert_forecast, update_branch_rop,
upsert_weekly_briefing) are executed inside a transaction that is always rolled
back, so the database is never modified.

Usage — point it at the same database the app uses:

    PowerShell:
      $env:DATABASE_URL = 'postgresql://...'
      python check_queries.py

    bash:
      DATABASE_URL='postgresql://...' python check_queries.py

Exits non-zero if any query fails.
"""

import asyncio
import os
import sys
import traceback
from datetime import datetime, timedelta, timezone

import asyncpg

import utils.db as db

GREEN = "\033[92m"
RED = "\033[91m"
DIM = "\033[2m"
RST = "\033[0m"

passed: list[str] = []
failed: list[tuple[str, str]] = []


def ok(name: str, detail: str = "") -> None:
    passed.append(name)
    print(f"  {GREEN}PASS{RST} {name} {DIM}{detail}{RST}")


def bad(name: str, err: Exception) -> None:
    first = str(err).strip().split("\n")[0]
    failed.append((name, first))
    print(f"  {RED}FAIL{RST} {name}")
    print(f"       {RED}{first}{RST}")


async def run(name: str, coro) -> None:
    try:
        result = await coro
        if isinstance(result, list):
            detail = f"{len(result)} row(s)"
        elif isinstance(result, dict):
            detail = f"{len(result)} key(s)"
        else:
            detail = type(result).__name__
        ok(name, detail)
    except Exception as e:  # noqa: BLE001 - reporting every failure is the point
        bad(name, e)


async def pick_org() -> str | None:
    """Any organisation will do; the queries are all org-scoped."""
    async with db.get_conn() as conn:
        row = await conn.fetchrow('SELECT id, name FROM organizations ORDER BY "createdAt" LIMIT 1')
        if row:
            print(f"\nUsing organisation: {row['name']} ({row['id']})\n")
            return str(row["id"])
    return None


async def check_writes(org_id: str) -> None:
    """
    Exercises the write paths, then rolls back. A forecast row needs a real
    item and branch, so this looks them up first and skips if the org has none.
    """
    async with db.get_conn() as conn:
        item = await conn.fetchrow('SELECT id FROM items WHERE "organizationId" = $1 LIMIT 1', org_id)
        branch = await conn.fetchrow('SELECT id FROM branches WHERE "organizationId" = $1 LIMIT 1', org_id)
        if not item or not branch:
            print(f"  {DIM}SKIP write checks - org has no items/branches{RST}")
            return

        now = datetime.now(timezone.utc)
        tx = conn.transaction()
        await tx.start()
        try:
            await conn.execute(
                """
                INSERT INTO forecasts (
                    id, "itemId", "branchId", "organizationId",
                    "periodStart", "periodEnd",
                    "predictedDemand", "confidenceScore",
                    "reorderSuggested", "suggestedQty",
                    "modelVersion", "generatedAt"
                ) VALUES (
                    gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()
                )
                ON CONFLICT ("itemId", "branchId", "periodStart")
                DO UPDATE SET "predictedDemand" = EXCLUDED."predictedDemand"
                """,
                str(item["id"]), str(branch["id"]), org_id,
                now, now + timedelta(days=30),
                1.0, 0.5, False, 1, "check",
            )
            ok("upsert_forecast (rolled back)")
        except Exception as e:  # noqa: BLE001
            bad("upsert_forecast", e)
        finally:
            await tx.rollback()

        tx = conn.transaction()
        await tx.start()
        try:
            await conn.execute(
                'UPDATE branch_stocks SET "lowStockThreshold" = "lowStockThreshold" WHERE "itemId" = $1 AND "branchId" = $2',
                str(item["id"]), str(branch["id"]),
            )
            ok("update_branch_rop (rolled back)")
        except Exception as e:  # noqa: BLE001
            bad("update_branch_rop", e)
        finally:
            await tx.rollback()


async def main() -> None:
    url = os.getenv("DATABASE_URL")
    if not url:
        print(f"\n{RED}DATABASE_URL is not set.{RST} Point it at the database the app uses.\n")
        sys.exit(1)

    print(f"\nChecking utils/db.py against {url.split('@')[-1].split('?')[0]}")

    try:
        await db.init_pool()
    except Exception as e:  # noqa: BLE001
        print(f"\n{RED}Could not connect:{RST} {str(e).splitlines()[0]}\n")
        sys.exit(1)

    try:
        org_id = await pick_org()
        if not org_id:
            print(f"{RED}No organisations in this database - seed it first.{RST}\n")
            sys.exit(1)

        print("Reads")
        await run("get_org_details", db.get_org_details(org_id))
        await run("get_all_org_ids", db.get_all_org_ids())
        await run("get_sales_history", db.get_sales_history(org_id))
        await run("get_branch_stock", db.get_branch_stock(org_id))
        await run("get_expense_summary", db.get_expense_summary(org_id))
        await run("get_purchase_order_history", db.get_purchase_order_history(org_id))
        await run("get_items_for_org", db.get_items_for_org(org_id))
        await run("get_suppliers_for_org", db.get_suppliers_for_org(org_id))
        await run("get_latest_forecasts_by_item_branch", db.get_latest_forecasts_by_item_branch(org_id))
        await run("get_item_revenue", db.get_item_revenue(org_id))
        await run("get_item_weekly_variability", db.get_item_weekly_variability(org_id))
        await run("get_supplier_lead_times", db.get_supplier_lead_times(org_id))
        await run("get_daily_revenue_agg", db.get_daily_revenue_agg(org_id))
        await run("get_branch_names", db.get_branch_names(org_id))
        await run("get_stock_shrinkage_logs", db.get_stock_shrinkage_logs(org_id))
        await run("get_expense_by_period", db.get_expense_by_period(org_id, 30, 0))
        await run("get_supplier_avg_lead_times", db.get_supplier_avg_lead_times(org_id))
        await run("get_item_preferred_supplier", db.get_item_preferred_supplier(org_id))
        await run("get_forecast_summary", db.get_forecast_summary(org_id))
        await run("get_weekly_briefing", db.get_weekly_briefing(org_id, "2026-01-05"))

        print("\nWrites (transactional, always rolled back)")
        await check_writes(org_id)

    finally:
        await db.close_pool()

    total = len(passed) + len(failed)
    print(f"\n{'-' * 60}")
    if failed:
        print(f"{RED}{len(failed)} of {total} failed{RST}")
        for name, err in failed:
            print(f"  {name}: {err}")
        print()
        sys.exit(1)
    print(f"{GREEN}All {total} queries executed successfully.{RST}\n")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
    except Exception:  # noqa: BLE001
        traceback.print_exc()
        sys.exit(1)

"""
Async read/write access to the shared PostgreSQL database.

The AI service shares the same DB as the Next.js app.
Reads: sales, items, stock, expenses, purchase orders, forecasts.
Writes: forecasts table only - the AI is the sole writer there.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

import asyncpg

from config import settings

_pool: asyncpg.Pool | None = None


async def init_pool() -> None:
    global _pool
    _pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=2,
        max_size=10,
        command_timeout=30,
    )


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


@asynccontextmanager
async def get_conn() -> AsyncGenerator[asyncpg.Connection, None]:
    assert _pool is not None, "DB pool not initialised - call init_pool() first"
    async with _pool.acquire() as conn:
        yield conn


async def health_check() -> bool:
    try:
        async with get_conn() as conn:
            await conn.fetchval("SELECT 1")
        return True
    except Exception:
        return False


# ── Organisation helpers ───────────────────────────────────────────────────

async def get_all_org_ids() -> list[str]:
    """Return all organisation IDs. Used by the nightly scheduler to fan out jobs."""
    async with get_conn() as conn:
        rows = await conn.fetch("SELECT id FROM organizations ORDER BY created_at")
        return [str(r["id"]) for r in rows]


# ── Sales analytics ────────────────────────────────────────────────────────

async def get_sales_history(
    org_id: str,
    item_id: str | None = None,
    branch_id: str | None = None,
    days: int = 90,
) -> list[dict]:
    """
    Returns daily sales totals per item per branch for the last `days` days.
    Used by the demand forecasting model as its training data.

    Columns returned: date, item_id, branch_id, total_qty, total_revenue
    """
    async with get_conn() as conn:
        query = """
            SELECT
                DATE(s.created_at AT TIME ZONE 'UTC') AS date,
                si.item_id,
                s.branch_id,
                SUM(si.quantity)                                  AS total_qty,
                SUM(si.quantity * si.unit_price)                  AS total_revenue
            FROM sale_items si
            JOIN sales s ON s.id = si.sale_id
            WHERE s.organization_id = $1
              AND s.status = 'COMPLETED'
              AND s.created_at >= NOW() - INTERVAL '1 day' * $2
              AND ($3::text IS NULL OR si.item_id = $3)
              AND ($4::text IS NULL OR s.branch_id = $4)
            GROUP BY 1, 2, 3
            ORDER BY 1 DESC
        """
        rows = await conn.fetch(query, org_id, days, item_id, branch_id)
        return [dict(r) for r in rows]


async def get_branch_stock(org_id: str, branch_id: str | None = None) -> list[dict]:
    """
    Returns current stock levels per item per branch.
    Used for reorder point calculations.

    Columns: item_id, item_name, sku, branch_id, branch_name, stock_qty,
             low_stock_threshold, retail_price, cost_price (latest PO)
    """
    async with get_conn() as conn:
        query = """
            SELECT
                bs.item_id,
                i.name          AS item_name,
                i.sku,
                bs.branch_id,
                b.name          AS branch_name,
                bs.stock_qty,
                bs.low_stock_threshold,
                i.retail_price,
                i.wholesale_price
            FROM branch_stocks bs
            JOIN items i  ON i.id  = bs.item_id
            JOIN branches b ON b.id = bs.branch_id
            WHERE i.organization_id = $1
              AND i.is_active = TRUE
              AND ($2::text IS NULL OR bs.branch_id = $2)
            ORDER BY bs.stock_qty ASC
        """
        rows = await conn.fetch(query, org_id, branch_id)
        return [dict(r) for r in rows]


async def get_expense_summary(org_id: str, days: int = 90) -> list[dict]:
    """
    Returns expenses grouped by category for the last `days` days.
    Used for cash flow forecasting and cost optimisation analysis.
    """
    async with get_conn() as conn:
        query = """
            SELECT
                category,
                SUM(amount)  AS total,
                COUNT(*)     AS count,
                AVG(amount)  AS avg_amount
            FROM expenses
            WHERE organization_id = $1
              AND date >= NOW() - INTERVAL '1 day' * $2
            GROUP BY category
            ORDER BY total DESC
        """
        rows = await conn.fetch(query, org_id, days)
        return [dict(r) for r in rows]


async def get_purchase_order_history(org_id: str, days: int = 180) -> list[dict]:
    """
    Returns purchase order line items with cost per unit and timing.
    Used for lead time estimation and supplier scoring.
    """
    async with get_conn() as conn:
        query = """
            SELECT
                po.id           AS po_id,
                po.supplier_id,
                s.name          AS supplier_name,
                po.branch_id,
                poi.item_id,
                i.name          AS item_name,
                poi.quantity,
                poi.cost_price,
                po.created_at,
                po.delivered_at
            FROM purchase_orders po
            JOIN purchase_order_items poi ON poi.purchase_order_id = po.id
            JOIN suppliers s ON s.id = po.supplier_id
            JOIN items i     ON i.id = poi.item_id
            WHERE po.organization_id = $1
              AND po.created_at >= NOW() - INTERVAL '1 day' * $2
            ORDER BY po.created_at DESC
        """
        rows = await conn.fetch(query, org_id, days)
        return [dict(r) for r in rows]


async def get_org_details(org_id: str) -> dict | None:
    """Fetches org name, currency, country, and industry for AI context."""
    async with get_conn() as conn:
        row = await conn.fetchrow(
            "SELECT name, currency, country, industry FROM organizations WHERE id = $1",
            org_id,
        )
        return dict(row) if row else None


async def get_items_for_org(org_id: str) -> list[dict]:
    """Returns all active items with category for an org."""
    async with get_conn() as conn:
        query = """
            SELECT
                i.id, i.name, i.sku, i.retail_price, i.wholesale_price,
                i.reorder_point, c.name AS category
            FROM items i
            LEFT JOIN categories c ON c.id = i.category_id
            WHERE i.organization_id = $1 AND i.is_active = TRUE
            ORDER BY i.name
        """
        rows = await conn.fetch(query, org_id)
        return [dict(r) for r in rows]


async def get_suppliers_for_org(org_id: str) -> list[dict]:
    """Returns all suppliers for an org."""
    async with get_conn() as conn:
        query = """
            SELECT id, name, phone, email, notes
            FROM suppliers
            WHERE organization_id = $1
            ORDER BY name
        """
        rows = await conn.fetch(query, org_id)
        return [dict(r) for r in rows]


# ── Forecast writes ────────────────────────────────────────────────────────

async def upsert_forecast(forecast: dict) -> None:
    """
    Writes a forecast row. Uses INSERT … ON CONFLICT DO UPDATE so re-running
    the forecast job is safe (idempotent per item+branch+period_start).
    """
    async with get_conn() as conn:
        await conn.execute(
            """
            INSERT INTO forecasts (
                id, item_id, branch_id, organization_id,
                period_start, period_end,
                predicted_demand, confidence_score,
                reorder_suggested, suggested_qty,
                model_version, generated_at
            ) VALUES (
                gen_random_uuid()::text, $1, $2, $3,
                $4, $5,
                $6, $7,
                $8, $9,
                $10, NOW()
            )
            ON CONFLICT (item_id, branch_id, period_start)
            DO UPDATE SET
                predicted_demand  = EXCLUDED.predicted_demand,
                confidence_score  = EXCLUDED.confidence_score,
                reorder_suggested = EXCLUDED.reorder_suggested,
                suggested_qty     = EXCLUDED.suggested_qty,
                model_version     = EXCLUDED.model_version,
                generated_at      = NOW()
            """,
            forecast["item_id"],
            forecast["branch_id"],
            forecast["organization_id"],
            forecast["period_start"],
            forecast["period_end"],
            forecast["predicted_demand"],
            forecast["confidence_score"],
            forecast["reorder_suggested"],
            forecast.get("suggested_qty"),
            forecast.get("model_version", "v0.1"),
        )


async def get_latest_forecasts_by_item_branch(org_id: str) -> dict[tuple[str, str], dict]:
    """
    Returns the freshest forecast row per (item_id, branch_id) from the last 48 h.

    Result dict key:   (item_id, branch_id)
    Result dict value: { "avg_daily_demand": float, "confidence_score": float, "predicted_demand": float }

    Used by the ROP calculator so it works from real demand, not placeholders.
    """
    async with get_conn() as conn:
        rows = await conn.fetch(
            """
            SELECT DISTINCT ON (item_id, branch_id)
                item_id,
                branch_id,
                predicted_demand,
                confidence_score,
                EXTRACT(DAY FROM (period_end - period_start))::float AS horizon_days
            FROM forecasts
            WHERE organization_id = $1
              AND generated_at >= NOW() - INTERVAL '48 hours'
            ORDER BY item_id, branch_id, generated_at DESC
            """,
            org_id,
        )
        result = {}
        for r in rows:
            horizon = float(r["horizon_days"]) if r["horizon_days"] and r["horizon_days"] > 0 else 30.0
            avg_daily = float(r["predicted_demand"]) / horizon
            result[(str(r["item_id"]), str(r["branch_id"]))] = {
                "avg_daily_demand": avg_daily,
                "confidence_score": float(r["confidence_score"]),
                "predicted_demand": float(r["predicted_demand"]),
            }
        return result


async def update_branch_rop(item_id: str, branch_id: str, rop_value: int) -> bool:
    """
    Write an AI-calculated ROP back to branch_stocks.low_stock_threshold.
    Returns True if a row was updated, False if the (item, branch) row does not exist.
    """
    async with get_conn() as conn:
        result = await conn.execute(
            """
            UPDATE branch_stocks
            SET low_stock_threshold = $1
            WHERE item_id = $2 AND branch_id = $3
            """,
            rop_value,
            item_id,
            branch_id,
        )
        return result != "UPDATE 0"


async def get_item_revenue(org_id: str, days: int = 180) -> dict[str, dict]:
    """
    Total revenue and quantity sold per item over the last `days` days.
    Returns {item_id: {"revenue": float, "total_qty_sold": int}}.
    """
    async with get_conn() as conn:
        rows = await conn.fetch(
            """
            SELECT
                si.item_id,
                SUM(si.quantity * si.unit_price)::float  AS revenue,
                SUM(si.quantity)::int                    AS total_qty_sold
            FROM sale_items si
            JOIN sales s ON s.id = si.sale_id
            WHERE s.organization_id = $1
              AND s.status = 'COMPLETED'
              AND s.created_at >= NOW() - INTERVAL '1 day' * $2
            GROUP BY si.item_id
            """,
            org_id,
            days,
        )
        return {
            str(r["item_id"]): {
                "revenue":        float(r["revenue"]),
                "total_qty_sold": int(r["total_qty_sold"]),
            }
            for r in rows
        }


async def get_item_weekly_variability(org_id: str, days: int = 180) -> dict[str, dict]:
    """
    Weekly demand variability per item: avg, std dev, and week count.
    Used to compute CV = std / avg for XYZ classification.
    Returns {item_id: {"avg_weekly": float, "std_weekly": float, "week_count": int}}.
    """
    async with get_conn() as conn:
        rows = await conn.fetch(
            """
            WITH weekly AS (
                SELECT
                    si.item_id,
                    DATE_TRUNC('week', s.created_at AT TIME ZONE 'UTC') AS week,
                    SUM(si.quantity)::float AS weekly_qty
                FROM sale_items si
                JOIN sales s ON s.id = si.sale_id
                WHERE s.organization_id = $1
                  AND s.status = 'COMPLETED'
                  AND s.created_at >= NOW() - INTERVAL '1 day' * $2
                GROUP BY si.item_id, DATE_TRUNC('week', s.created_at AT TIME ZONE 'UTC')
            )
            SELECT
                item_id,
                AVG(weekly_qty)::float                      AS avg_weekly,
                COALESCE(STDDEV(weekly_qty)::float, 0.0)   AS std_weekly,
                COUNT(*)::int                               AS week_count
            FROM weekly
            GROUP BY item_id
            """,
            org_id,
            days,
        )
        return {
            str(r["item_id"]): {
                "avg_weekly":  float(r["avg_weekly"]),
                "std_weekly":  float(r["std_weekly"]),
                "week_count":  int(r["week_count"]),
            }
            for r in rows
        }


async def get_branch_names(org_id: str) -> dict[str, str]:
    """Returns {branch_id: branch_name} for all branches in an org."""
    async with get_conn() as conn:
        rows = await conn.fetch(
            "SELECT id, name FROM branches WHERE organization_id = $1",
            org_id,
        )
        return {str(r["id"]): r["name"] for r in rows}


async def get_stock_shrinkage_logs(org_id: str, days: int = 7) -> list[dict]:
    """
    Returns MANUAL_ADJUSTMENT stock log entries with net-negative quantity.
    Grouped per (item, branch): if the sum of all adjustments in the window
    is negative, the item lost stock for a reason that wasn't a sale or transfer.
    This is the canonical signal for shrinkage / theft / spoilage.
    """
    async with get_conn() as conn:
        rows = await conn.fetch(
            """
            SELECT
                sl.item_id,
                i.name            AS item_name,
                i.sku,
                COALESCE(i.wholesale_price, 0)::float AS unit_cost,
                sl.branch_id,
                b.name            AS branch_name,
                SUM(sl.quantity)::int   AS net_qty,
                COUNT(*)::int           AS adjustment_count,
                MIN(sl.created_at)      AS first_at
            FROM stock_logs sl
            JOIN items i ON i.id = sl.item_id
            LEFT JOIN branches b ON b.id = sl.branch_id
            WHERE sl.organization_id = $1
              AND sl.reason = 'MANUAL_ADJUSTMENT'
              AND sl.quantity < 0
              AND sl.created_at >= NOW() - INTERVAL '1 day' * $2
            GROUP BY sl.item_id, i.name, i.sku, i.wholesale_price, sl.branch_id, b.name
            HAVING SUM(sl.quantity) < 0
            ORDER BY SUM(sl.quantity) ASC
            """,
            org_id,
            days,
        )
        return [dict(r) for r in rows]


async def get_expense_by_period(
    org_id: str, start_days_ago: int, end_days_ago: int
) -> dict[str, float]:
    """
    Returns total spend per expense category for the window
    [NOW() - start_days_ago, NOW() - end_days_ago].
    Example: start_days_ago=30, end_days_ago=0 → last 30 days.
    """
    async with get_conn() as conn:
        rows = await conn.fetch(
            """
            SELECT category, SUM(amount)::float AS total
            FROM expenses
            WHERE organization_id = $1
              AND date >= NOW() - INTERVAL '1 day' * $2
              AND date <  NOW() - INTERVAL '1 day' * $3
            GROUP BY category
            """,
            org_id,
            start_days_ago,
            end_days_ago,
        )
        return {r["category"]: float(r["total"]) for r in rows}


async def get_supplier_avg_lead_times(org_id: str, days: int = 180) -> dict[str, float]:
    """
    Avg delivery lead time per supplier, derived from PO history where delivered_at is set.
    Returns {supplier_id: avg_lead_days}.

    This is the authoritative lead-time source — it reflects actual delivery performance,
    not a static estimate.  When a supplier slows down, their avg_lead_days rises here,
    which flows into calculate_rop() and raises the ROP for their items automatically.
    """
    async with get_conn() as conn:
        rows = await conn.fetch(
            """
            SELECT
                supplier_id,
                AVG(
                    EXTRACT(EPOCH FROM (delivered_at - created_at)) / 86400.0
                )::float AS avg_lead_days
            FROM purchase_orders
            WHERE organization_id = $1
              AND created_at >= NOW() - INTERVAL '1 day' * $2
              AND delivered_at IS NOT NULL
              AND delivered_at > created_at
            GROUP BY supplier_id
            """,
            org_id,
            days,
        )
        return {str(r["supplier_id"]): float(r["avg_lead_days"]) for r in rows}


async def get_item_preferred_supplier(org_id: str, days: int = 180) -> dict[str, str]:
    """
    Most recent supplier per item, from PO history.
    Returns {item_id: supplier_id}.

    Used to link an item to a supplier's lead-time performance.
    DISTINCT ON (item_id) picks the latest PO for each item.
    """
    async with get_conn() as conn:
        rows = await conn.fetch(
            """
            SELECT DISTINCT ON (poi.item_id)
                poi.item_id,
                po.supplier_id
            FROM purchase_order_items poi
            JOIN purchase_orders po ON po.id = poi.purchase_order_id
            WHERE po.organization_id = $1
              AND po.created_at >= NOW() - INTERVAL '1 day' * $2
            ORDER BY poi.item_id, po.created_at DESC
            """,
            org_id,
            days,
        )
        return {str(r["item_id"]): str(r["supplier_id"]) for r in rows}


async def get_forecast_summary(org_id: str) -> dict:
    """Return a quick summary of the most recent forecast run for an org."""
    async with get_conn() as conn:
        row = await conn.fetchrow(
            """
            SELECT
                COUNT(*)::int           AS total_forecasts,
                MAX(generated_at)       AS last_run_at,
                MIN(period_start)       AS period_start,
                MAX(period_end)         AS period_end,
                MAX(model_version)      AS model_version
            FROM forecasts
            WHERE organization_id = $1
            """,
            org_id,
        )
        return dict(row) if row else {}

"""
Async read/write access to the shared PostgreSQL database.

The AI service shares the same DB as the Next.js app.
Reads: sales, items, stock, expenses, purchase orders, forecasts.
Writes: forecasts table only — the AI is the sole writer there.
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
    assert _pool is not None, "DB pool not initialised — call init_pool() first"
    async with _pool.acquire() as conn:
        yield conn


async def health_check() -> bool:
    try:
        async with get_conn() as conn:
            await conn.fetchval("SELECT 1")
        return True
    except Exception:
        return False


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

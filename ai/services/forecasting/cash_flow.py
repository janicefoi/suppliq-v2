"""
Cash Flow Forecasting Service

What this will do:
  1. Collect 90-day revenue trend from sales history
  2. Collect expense run-rate by category from the last 60 days
  3. Estimate upcoming purchase commitments from reorder recommendations
  4. Project 30/60/90-day cash position
  5. Pass data to Claude for a CFO-style commentary
  6. Return structured forecast + natural-language commentary

Output shape:
  {
    projected_revenue_30d: float,
    projected_expenses_30d: float,
    projected_purchases_30d: float,
    net_cash_30d: float,
    commentary: str,           ← Claude-generated
    breakdown: [...],
  }

TODO phases:
  Phase 1: Rolling average of past 30 days × 1 (simple projection)
  Phase 2: Trend-adjusted using linear regression on daily revenue
  Phase 3: Include seasonal adjustments from demand forecast
  Phase 4: Factor in outstanding credit balances from customers
"""

from utils.db import get_sales_history, get_expense_summary
from utils.llm import generate_cash_flow_commentary


async def run_cash_flow_forecast(org_id: str) -> dict:
    """
    Returns a 30-day cash flow projection with Claude commentary.
    """
    # TODO: implement full forecasting logic in Phase 1
    # For now: fetch the data and return a stub structure

    sales = await get_sales_history(org_id, days=30)
    expenses = await get_expense_summary(org_id, days=30)

    total_revenue = sum(float(r["total_revenue"]) for r in sales)
    total_expenses = sum(float(e["total"]) for e in expenses)

    # Placeholder — will be replaced with trend-based projection
    projected_revenue_30d = total_revenue
    projected_expenses_30d = total_expenses
    projected_purchases_30d = 0.0   # populated once reorder optimizer runs

    net_cash_30d = projected_revenue_30d - projected_expenses_30d - projected_purchases_30d

    commentary = await generate_cash_flow_commentary(
        revenue_trend=sales[-7:] if len(sales) >= 7 else sales,
        expense_summary=expenses,
        projected_purchases=projected_purchases_30d,
    )

    return {
        "projected_revenue_30d": round(projected_revenue_30d, 2),
        "projected_expenses_30d": round(projected_expenses_30d, 2),
        "projected_purchases_30d": round(projected_purchases_30d, 2),
        "net_cash_30d": round(net_cash_30d, 2),
        "commentary": commentary,
        "expense_breakdown": expenses,
    }

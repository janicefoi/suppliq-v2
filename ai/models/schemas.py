"""
Pydantic request / response schemas shared across all routers.
The AI service never writes to these tables directly except `forecasts`.
All other reads are SELECT-only against the Next.js Postgres DB.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


# ── Health ─────────────────────────────────────────────────────────────────

class ServiceStatus(BaseModel):
    status: str                      # "ok" | "degraded" | "error"
    version: str
    db_connected: bool
    claude_configured: bool
    timestamp: datetime


# ── Forecast ───────────────────────────────────────────────────────────────

class ForecastRequest(BaseModel):
    organization_id: str
    item_id: Optional[str] = None    # None = run for all items
    branch_id: Optional[str] = None  # None = run for all branches
    horizon_days: int = 30            # how many days ahead to forecast


class ForecastResult(BaseModel):
    item_id: str
    branch_id: str
    period_start: datetime
    period_end: datetime
    predicted_demand: float
    confidence_score: float           # 0.0 – 1.0
    reorder_suggested: bool
    suggested_qty: Optional[int]
    model_version: str


class ForecastResponse(BaseModel):
    organization_id: str
    forecasts: list[ForecastResult]
    generated_at: datetime


# ── Intelligence ───────────────────────────────────────────────────────────

class NewsItem(BaseModel):
    title: str
    source: str
    url: str
    published_at: Optional[datetime]
    summary: str                      # Claude-generated summary
    relevance_score: float            # 0.0 – 1.0
    tags: list[str]                   # e.g. ["disruption", "pricing", "logistics"]
    impact: str                       # "positive" | "negative" | "neutral"


class MarketPrice(BaseModel):
    commodity: str                    # e.g. "crude_oil", "eur_usd"
    price: float
    currency: str
    change_pct_24h: Optional[float]
    source: str
    fetched_at: datetime


class SupplierScore(BaseModel):
    supplier_id: str
    supplier_name: str
    overall_score: float              # 0 – 100
    delivery_reliability: float
    pricing_consistency: float
    order_fill_rate: float
    risk_level: str                   # "low" | "medium" | "high"
    recommendation: str               # Claude-generated text


# ── Optimization ───────────────────────────────────────────────────────────

class ReorderRecommendation(BaseModel):
    item_id: str
    item_name: str
    sku: str
    branch_id: str
    branch_name: str
    current_stock: int
    reorder_point: int
    suggested_order_qty: int
    estimated_days_until_stockout: Optional[int]
    priority: str                     # "critical" | "high" | "medium" | "low"
    reasoning: str                    # Claude-generated explanation


class PricingRecommendation(BaseModel):
    item_id: str
    item_name: str
    current_retail_price: float
    suggested_retail_price: float
    current_wholesale_price: float
    suggested_wholesale_price: float
    margin_current: float
    margin_suggested: float
    reasoning: str


# ── Anomaly ────────────────────────────────────────────────────────────────

class Anomaly(BaseModel):
    type: str                         # "sales_spike" | "sales_drop" | "stock_discrepancy" | "unusual_expense"
    severity: str                     # "info" | "warning" | "critical"
    entity_type: str                  # "item" | "branch" | "customer" | "expense"
    entity_id: str
    entity_name: str
    description: str
    detected_at: datetime
    suggested_action: str


# ── Recommendations (catch-all smart suggestions) ─────────────────────────

class SmartRecommendation(BaseModel):
    id: str
    category: str   # "reorder" | "pricing" | "supplier" | "cost_reduction" | "demand" | "risk"
    priority: str   # "critical" | "high" | "medium" | "low"
    title: str
    detail: str
    estimated_impact: Optional[str]   # e.g. "Save 1,200/month in currency units"
    action_url: Optional[str]         # deep-link into the Next.js app
    created_at: datetime

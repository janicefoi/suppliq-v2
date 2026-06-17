"""
SUPPLIQ AI Service
==================
FastAPI microservice that powers the AI layer of the SUPPLIQ ERP platform.

Capabilities:
  /forecast/demand          - Demand forecasting (EMA → Prophet → LSTM)
  /forecast/cash-flow       - 30-day cash flow projection with Claude commentary
  /intelligence/news        - Supply chain news feed, scored & summarised by Claude
  /intelligence/market-prices - Live commodity prices & FX rates (Alpha Vantage)
  /intelligence/supplier-scores - Supplier risk scoring with Claude narrative
  /optimize/reorder         - Reorder recommendations (ROP + EOQ) with Claude reasoning
  /anomalies                - Sales, stock, and expense anomaly detection
  /health                   - Liveness + readiness probe

All endpoints are organisation-scoped.
The service shares the same PostgreSQL DB as the Next.js app:
  - Reads: sales, items, stock, expenses, purchase orders
  - Writes: forecasts table only

Run locally:
  uvicorn main:app --reload --port 8000

Env vars: copy .env.example → .env and fill in values.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from utils.db import init_pool, close_pool
from scheduler import init_scheduler, shutdown_scheduler
from routers.health import router as health_router
from routers.forecast import router as forecast_router
from routers.intelligence import router as intelligence_router
from routers.optimization import router as optimization_router
from routers.anomalies import router as anomalies_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    init_scheduler()
    yield
    shutdown_scheduler()
    await close_pool()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=__doc__,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.nextjs_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(forecast_router)
app.include_router(intelligence_router)
app.include_router(optimization_router)
app.include_router(anomalies_router)

from fastapi import APIRouter, Query

from services.intelligence.news import get_supply_chain_news
from services.intelligence.market import get_market_prices, get_fx_pairs_for_currency, DEFAULT_COMMODITIES
from services.intelligence.supplier_score import score_all_suppliers
from services.intelligence.briefing import generate_briefing_for_org
from utils.db import get_org_details

router = APIRouter(prefix="/intelligence", tags=["Market Intelligence"])


@router.get("/news")
async def supply_chain_news(
    organization_id: str = Query(..., description="Org ID for personalised relevance scoring"),
    limit: int = Query(20, ge=1, le=50),
):
    """
    Aggregated supply chain news feed, enriched by Claude.

    Sources: Reuters, Supply Chain Dive, FreightWaves, NewsAPI, Logistics Manager.
    Each article is scored for relevance to the org (derived from DB), tagged,
    and summarised by Claude.

    Returns articles sorted by relevance score (highest first).
    """
    org = await get_org_details(organization_id)
    if org:
        industry = org.get("industry") or "supply chain and inventory management"
        country = org.get("country", "EU")
        org_context = f"{org['name']} — a business in {country} operating in {industry}"
    else:
        org_context = "A European business managing inventory and supply chain operations"

    articles = await get_supply_chain_news(org_context=org_context, limit=limit)
    return {"organization_id": organization_id, "articles": articles, "count": len(articles)}


@router.get("/market-prices/{organization_id}")
async def market_prices(
    organization_id: str,
    commodities: str = Query(
        ",".join(DEFAULT_COMMODITIES),
        description="Comma-separated commodity keys to fetch",
    ),
):
    """
    Live commodity prices and currency exchange rates.

    FX pairs are automatically derived from the org's base currency.
    Commodity prices come from Alpha Vantage (free tier).
    Significant moves (>2% in 24h) are returned as alerts.

    Requires ALPHA_VANTAGE_API_KEY in .env.
    """
    org = await get_org_details(organization_id)
    currency = org["currency"] if org else "EUR"
    fx_list = get_fx_pairs_for_currency(currency)
    commodity_list = [c.strip() for c in commodities.split(",") if c.strip()]
    result = await get_market_prices(commodities=commodity_list, fx_pairs=fx_list)
    return {**result, "base_currency": currency}


@router.get("/supplier-scores/{organization_id}")
async def supplier_scores(organization_id: str):
    """
    Scores all suppliers for an organisation across three dimensions:
    delivery reliability, pricing consistency, and order fill rate.

    Each supplier gets an overall score (0-100), a risk level, and
    a Claude-generated narrative recommendation.

    Returns sorted worst-first so high-risk suppliers surface at the top.
    """
    scores = await score_all_suppliers(org_id=organization_id)
    return {
        "organization_id": organization_id,
        "suppliers": scores,
        "count": len(scores),
        "high_risk_count": sum(1 for s in scores if s["risk_level"] == "high"),
    }


@router.get("/weekly-briefing/{organization_id}")
async def weekly_briefing(
    organization_id: str,
    force: bool = Query(False, description="Regenerate even if a briefing already exists this week"),
):
    """
    Returns the current week's AI briefing for an organisation.

    On first call (or if force=True), generates the briefing by gathering:
      - Top 3 stockout risks (from demand forecasts × current stock)
      - Biggest anomaly detected this week
      - Supplier with longest average lead time
    Then calls Claude once to write the entire briefing as plain prose.

    Subsequent calls in the same week return the cached DB row instantly.
    The scheduler triggers this automatically every Monday at 08:00 UTC.
    """
    return await generate_briefing_for_org(org_id=organization_id, force=force)

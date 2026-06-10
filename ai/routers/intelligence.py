from fastapi import APIRouter, Query

from services.intelligence.news import get_supply_chain_news
from services.intelligence.market import get_market_prices
from services.intelligence.supplier_score import score_all_suppliers

router = APIRouter(prefix="/intelligence", tags=["Market Intelligence"])


@router.get("/news")
async def supply_chain_news(
    organization_id: str = Query(..., description="Org ID for personalised relevance scoring"),
    org_context: str = Query(
        "A Kenyan business managing inventory and supply chain operations",
        description="Short description of the org used by Claude for relevance scoring",
    ),
    limit: int = Query(20, ge=1, le=50),
):
    """
    Aggregated supply chain news feed, enriched by Claude.

    Sources: Reuters, Supply Chain Dive, FreightWaves, NewsAPI, Business Daily Africa.
    Each article is scored for relevance, tagged, and summarised by Claude.

    Returns articles sorted by relevance score (highest first).
    """
    articles = await get_supply_chain_news(org_context=org_context, limit=limit)
    return {"organization_id": organization_id, "articles": articles, "count": len(articles)}


@router.get("/market-prices")
async def market_prices(
    commodities: str = Query(
        "brent_crude,wheat,corn,sugar",
        description="Comma-separated commodity keys to fetch",
    ),
    fx_pairs: str = Query(
        "KES/USD,KES/EUR,KES/CNY",
        description="Comma-separated FX pairs to fetch",
    ),
):
    """
    Live commodity prices and currency exchange rates.

    Commodity prices come from Alpha Vantage (free tier).
    FX rates come from Alpha Vantage or ExchangeRatesAPI.
    Significant moves (>2% in 24h) are returned as alerts.

    Requires ALPHA_VANTAGE_API_KEY in .env.
    """
    commodity_list = [c.strip() for c in commodities.split(",") if c.strip()]
    fx_list = [f.strip() for f in fx_pairs.split(",") if f.strip()]
    result = await get_market_prices(commodities=commodity_list, fx_pairs=fx_list)
    return result


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

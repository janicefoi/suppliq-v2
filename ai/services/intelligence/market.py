"""
Market Price & Currency Intelligence Service

What this will do:
  1. Fetch live commodity prices relevant to supply chain costs:
       - Crude oil (Brent) — affects transport costs
       - Steel, aluminium, copper — manufacturing inputs
       - Wheat, maize, sugar — food & beverage businesses
       - Diesel fuel — direct logistics cost
  2. Fetch live currency rates:
       - EUR/USD, GBP/USD, EUR/GBP, EUR/JPY
       (Critical for businesses importing goods priced in foreign currency)
  3. Detect significant price movements (>2% in 24h) and flag as alerts
  4. Return trends for dashboard sparklines

Data sources:
  - Alpha Vantage API (free tier: 25 req/day)
      Commodities: WTI_CRUDE_OIL, BRENT_CRUDE_OIL, NATURAL_GAS, COPPER,
                   ALUMINUM, WHEAT, CORN, SUGAR, COFFEE
      FX: CURRENCY_EXCHANGE_RATE
  - ExchangeRatesAPI.io (free tier: 250 req/month)
      FX: latest rates against base currency

Phase 2:
  - Cache prices in Redis with TTL=1h so we don't burn API quotas
  - Track 30-day history in a local time-series table for sparklines
  - Alert when a commodity that matches org's product categories moves >5%
"""

from datetime import datetime
from typing import Optional

import httpx

from config import settings


COMMODITY_SYMBOLS = {
    "brent_crude":  "BRENT_CRUDE_OIL",
    "wti_crude":    "WTI_CRUDE_OIL",
    "natural_gas":  "NATURAL_GAS",
    "copper":       "COPPER",
    "aluminum":     "ALUMINUM",
    "wheat":        "WHEAT",
    "corn":         "CORN",
    "sugar":        "SUGAR",
}

DEFAULT_COMMODITIES = ["brent_crude", "wheat", "corn", "sugar"]
DEFAULT_FX_PAIRS = ["EUR/USD", "GBP/USD", "EUR/GBP", "EUR/JPY"]


async def _fetch_alpha_vantage_commodity(symbol: str) -> Optional[dict]:
    """Fetch latest commodity price from Alpha Vantage."""
    if not settings.alpha_vantage_api_key:
        return None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://www.alphavantage.co/query",
                params={
                    "function": "COMMODITY_DAILY",
                    "symbol": symbol,
                    "apikey": settings.alpha_vantage_api_key,
                },
            )
            resp.raise_for_status()
            data = resp.json()
        time_series = data.get("data", [])
        if len(time_series) < 2:
            return None
        latest = time_series[0]
        prev = time_series[1]
        price = float(latest["value"])
        prev_price = float(prev["value"])
        change_pct = ((price - prev_price) / prev_price) * 100 if prev_price else 0
        return {
            "price": price,
            "currency": "USD",
            "change_pct_24h": round(change_pct, 2),
            "source": "Alpha Vantage",
            "fetched_at": datetime.utcnow().isoformat(),
        }
    except Exception:
        return None


async def _fetch_fx_rate(from_currency: str, to_currency: str) -> Optional[dict]:
    """Fetch live FX rate from Alpha Vantage."""
    if not settings.alpha_vantage_api_key:
        return None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://www.alphavantage.co/query",
                params={
                    "function": "CURRENCY_EXCHANGE_RATE",
                    "from_currency": from_currency,
                    "to_currency": to_currency,
                    "apikey": settings.alpha_vantage_api_key,
                },
            )
            resp.raise_for_status()
            data = resp.json()
        rate_data = data.get("Realtime Currency Exchange Rate", {})
        if not rate_data:
            return None
        return {
            "price": float(rate_data["5. Exchange Rate"]),
            "currency": to_currency,
            "change_pct_24h": None,  # Alpha Vantage doesn't return 24h change for FX
            "source": "Alpha Vantage",
            "fetched_at": datetime.utcnow().isoformat(),
        }
    except Exception:
        return None


async def get_market_prices(
    commodities: list[str] = DEFAULT_COMMODITIES,
    fx_pairs: list[str] = DEFAULT_FX_PAIRS,
) -> dict:
    """
    Returns commodity prices and FX rates.
    Falls back to empty dict per item if API keys not configured.

    Returns:
    {
        "commodities": { "brent_crude": {...}, ... },
        "fx_rates":    { "EUR/USD": {...}, ... },
        "alerts": [...]
    }
    """
    commodity_results = {}
    for name in commodities:
        symbol = COMMODITY_SYMBOLS.get(name)
        if symbol:
            result = await _fetch_alpha_vantage_commodity(symbol)
            if result:
                commodity_results[name] = {"commodity": name, **result}

    fx_results = {}
    for pair in fx_pairs:
        parts = pair.split("/")
        if len(parts) == 2:
            result = await _fetch_fx_rate(parts[0], parts[1])
            if result:
                fx_results[pair] = {"commodity": pair, **result}

    # Generate alerts for significant moves
    alerts = []
    for name, data in {**commodity_results, **fx_results}.items():
        chg = data.get("change_pct_24h")
        if chg is not None and abs(chg) >= 2.0:
            direction = "up" if chg > 0 else "down"
            alerts.append({
                "commodity": name,
                "change_pct": chg,
                "message": f"{name.replace('_', ' ').title()} moved {direction} {abs(chg):.1f}% in 24h",
                "severity": "warning" if abs(chg) >= 5 else "info",
            })

    return {
        "commodities": commodity_results,
        "fx_rates": fx_results,
        "alerts": alerts,
        "fetched_at": datetime.utcnow().isoformat(),
    }

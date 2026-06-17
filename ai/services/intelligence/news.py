"""
Supply Chain News Intelligence Service

Pipeline:
  1. Fetch headlines in parallel from RSS feeds + NewsAPI
  2. De-duplicate by URL
  3. Keyword pre-filter to avoid unnecessary Claude calls
  4. Enrich matching articles with Claude (parallel asyncio.gather) — summary,
     relevance score, impact, tags
  5. Sort by relevance and return top N

Locale handling:
  The base keyword set covers neutral supply-chain terms. Pass `country` (ISO
  3166-1 alpha-2, e.g. "FR") to append country-specific keywords so articles
  about e.g. French customs or Kenyan port disruptions score higher for orgs
  in those regions.

Caching:
  Results are cached in-process for CACHE_TTL_SECONDS (2 hours) keyed by
  (org_context_hash, country). This avoids re-running 10+ Claude calls on
  every page refresh. The cache is org-specific because relevance scoring
  differs by org industry and product categories.
"""

import asyncio
import hashlib
import re
import time
from datetime import datetime

import httpx
import feedparser

from config import settings
from utils.llm import analyse_news_article


# ── Keyword config ─────────────────────────────────────────────────────────

SUPPLY_CHAIN_KEYWORDS = [
    # Core — neutral, valid globally
    "supply chain", "logistics", "shipping", "freight", "commodity",
    "inflation", "port", "disruption", "fuel price", "currency",
    "import", "export", "trade", "manufacturing", "shortage",
    "tariff", "wholesale", "retail", "inventory", "warehouse", "procurement",
    "customs", "sanctions", "container",
]

# Region-specific terms added when org country matches.
# Keys are ISO 3166-1 alpha-2 country codes (uppercase).
REGIONAL_KEYWORDS: dict[str, list[str]] = {
    "FR": ["france", "french", "marseille", "le havre"],
    "GB": ["uk", "britain", "sterling", "pound", "ftse", "boe", "hmrc"],
    "DE": ["germany", "german", "hamburg", "bundesbank", "dax"],
    "NL": ["netherlands", "rotterdam", "dutch", "amsterdam"],
    "BE": ["belgium", "antwerp", "brussels"],
    "ES": ["spain", "spanish", "barcelona", "valencia"],
    "IT": ["italy", "italian", "genoa"],
    "PL": ["poland", "polish", "gdansk"],
    "US": ["federal reserve", "fed", "usd", "wall street"],
    "KE": ["kenya", "nairobi", "mombasa", "east africa", "kes"],
    "NG": ["nigeria", "lagos", "naira", "apapa"],
    "ZA": ["south africa", "johannesburg", "rand", "durban"],
    "GH": ["ghana", "accra", "cedi", "tema"],
    "JP": ["japan", "yen", "tokyo", "osaka"],
    "CN": ["china", "chinese", "shanghai", "shenzhen", "renminbi"],
    "IN": ["india", "indian", "mumbai", "chennai", "rupee"],
    "AU": ["australia", "australian", "sydney", "aud"],
}

RSS_FEEDS = [
    ("Reuters Business",  "https://feeds.reuters.com/reuters/businessNews"),
    ("Supply Chain Dive", "https://www.supplychaindive.com/feeds/news/"),
    ("FreightWaves",      "https://www.freightwaves.com/news/feed"),
    ("Logistics Manager", "https://www.logisticsmanager.com/feed/"),
]

# 2-hour in-process cache keyed by (org_context_hash, country)
_cache: dict[str, tuple[float, list[dict]]] = {}
CACHE_TTL_SECONDS = 7200


# ── Internal helpers ───────────────────────────────────────────────────────

def _build_keywords(country: str = "") -> list[str]:
    kws = list(SUPPLY_CHAIN_KEYWORDS)
    if country:
        kws.extend(REGIONAL_KEYWORDS.get(country.upper(), []))
    return kws


def _is_relevant(title: str, summary: str, keywords: list[str]) -> bool:
    """Quick keyword filter before paying for a Claude call."""
    text = (title + " " + summary).lower()
    return any(kw in text for kw in keywords)


async def _fetch_rss_feed(name: str, url: str) -> list[dict]:
    """Fetch and parse an RSS feed. Returns up to 20 raw articles."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, follow_redirects=True)
            resp.raise_for_status()
        feed = feedparser.parse(resp.text)
        items = []
        for entry in feed.entries[:20]:
            published = None
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                published = datetime(*entry.published_parsed[:6]).isoformat()
            items.append({
                "title":        entry.get("title", ""),
                "url":          entry.get("link", ""),
                "content":      re.sub(r"<[^>]+>", "", entry.get("summary", "")),
                "published_at": published,
                "source":       name,
            })
        return items
    except Exception:
        return []


async def _fetch_newsapi(query: str = "supply chain OR logistics OR commodity prices") -> list[dict]:
    """
    Fetches top headlines from NewsAPI.org.
    Requires NEWS_API_KEY in env. Returns empty list if not configured.
    """
    if not settings.news_api_key:
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://newsapi.org/v2/everything",
                params={
                    "q":        query,
                    "sortBy":   "publishedAt",
                    "pageSize": 30,
                    "language": "en",
                    "apiKey":   settings.news_api_key,
                },
            )
            resp.raise_for_status()
            data = resp.json()
        return [
            {
                "title":        a["title"],
                "url":          a["url"],
                "content":      a.get("content") or a.get("description") or "",
                "published_at": a.get("publishedAt"),
                "source":       a["source"]["name"],
            }
            for a in data.get("articles", [])
        ]
    except Exception:
        return []


async def _enrich_article(article: dict, org_context: str) -> dict:
    """
    Calls Claude to enrich a single article.
    Returns the article with AI-generated fields appended.
    Never raises — falls back to neutral values on error.
    """
    try:
        analysis = await analyse_news_article(
            title=article["title"],
            content=article["content"],
            org_context=org_context,
        )
        return {
            **article,
            "summary":         analysis.get("summary", ""),
            "relevance_score": float(analysis.get("relevance_score", 0.5)),
            "impact":          analysis.get("impact", "neutral"),
            "tags":            analysis.get("tags", []),
        }
    except Exception:
        return {
            **article,
            "summary":         article["content"][:200],
            "relevance_score": 0.5,
            "impact":          "neutral",
            "tags":            [],
        }


# ── Public API ─────────────────────────────────────────────────────────────

async def get_supply_chain_news(
    org_context: str,
    limit: int = 10,
    country: str = "",
) -> list[dict]:
    """
    Fetches, filters, and enriches supply chain news for an org.

    Args:
        org_context: Short description of the org (passed to Claude for relevance scoring).
        limit:       Maximum number of enriched articles to return.
        country:     ISO 3166-1 alpha-2 country code of the org (e.g. "FR", "KE").
                     Used to extend the keyword set with region-specific terms.

    Returns:
        List of enriched article dicts, sorted by relevance_score descending.
        Each article has: title, url, content, published_at, source,
                          summary, relevance_score, impact, tags.
    """
    # ── Cache check ────────────────────────────────────────────────────────
    ctx_hash   = hashlib.md5(org_context.encode()).hexdigest()[:8]
    cache_key  = f"{ctx_hash}:{country.upper()}"
    now        = time.time()
    if cache_key in _cache:
        expires_at, cached = _cache[cache_key]
        if now < expires_at:
            return cached[:limit]

    # ── Fetch all sources in parallel ──────────────────────────────────────
    rss_tasks = [_fetch_rss_feed(name, url) for name, url in RSS_FEEDS]
    all_results = await asyncio.gather(*rss_tasks, _fetch_newsapi())

    raw_articles: list[dict] = []
    for batch in all_results:
        raw_articles.extend(batch)

    # ── De-duplicate by URL ────────────────────────────────────────────────
    seen_urls: set[str] = set()
    unique = []
    for a in raw_articles:
        if a["url"] and a["url"] not in seen_urls:
            seen_urls.add(a["url"])
            unique.append(a)

    # ── Keyword pre-filter ─────────────────────────────────────────────────
    keywords = _build_keywords(country)
    relevant = [a for a in unique if _is_relevant(a["title"], a["content"], keywords)]

    # ── Parallel Claude enrichment ─────────────────────────────────────────
    # Cap at 12 articles to avoid rate limits; return top `limit` after scoring.
    to_enrich = relevant[:12]
    enriched: list[dict] = list(
        await asyncio.gather(*[_enrich_article(a, org_context) for a in to_enrich])
    )
    enriched.sort(key=lambda x: x["relevance_score"], reverse=True)

    # ── Store in cache ─────────────────────────────────────────────────────
    _cache[cache_key] = (now + CACHE_TTL_SECONDS, enriched)

    return enriched[:limit]

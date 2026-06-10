"""
Supply Chain News Intelligence Service

What this will do:
  1. Pull headlines from multiple sources on a schedule (every 2h)
  2. Filter for supply chain relevance using keyword matching
  3. Pass each article to Claude for: summary, impact score, tags
  4. Return ranked, de-duplicated news feed per org (filtered by their categories + industry)

Data sources (all have free tiers):
  - NewsAPI       - global headlines filtered by supply chain keywords
  - Reuters RSS   - https://feeds.reuters.com/reuters/businessNews
  - AP News RSS   - https://apnews.com/hub/business
  - Supply Chain Dive RSS - https://www.supplychaindive.com/feeds/news/
  - FreightWaves  - https://www.freightwaves.com/news/feed
  - Logistics Manager - https://www.logisticsmanager.com/feed/ (UK/Europe)
  - European Shipper - https://www.shippingeurope.news/feed (regional)

Keyword filter (Phase 1):
  supply chain, logistics, shipping, freight, commodity, inflation,
  port disruption, fuel price, currency, import, export, trade,
  manufacturing, shortage, tariff, EU, europe, customs, sanctions

Phase 2 - personalised per org:
  - Use org's item categories as additional keywords
  - Use org's supplier names for supplier-specific alerts
  - Use org's industry to boost sector-specific news
"""

import asyncio
import re
from datetime import datetime
from typing import Optional

import httpx
import feedparser

from config import settings
from utils.llm import analyse_news_article


SUPPLY_CHAIN_KEYWORDS = [
    "supply chain", "logistics", "shipping", "freight", "commodity",
    "inflation", "port", "disruption", "fuel price", "currency",
    "import", "export", "trade", "manufacturing", "shortage",
    "tariff", "wholesale", "retail", "inventory", "warehouse", "procurement",
    "europe", "EU", "customs", "sanctions", "euro", "sterling",
]

RSS_FEEDS = [
    ("Reuters Business",    "https://feeds.reuters.com/reuters/businessNews"),
    ("Supply Chain Dive",   "https://www.supplychaindive.com/feeds/news/"),
    ("FreightWaves",        "https://www.freightwaves.com/news/feed"),
    ("Logistics Manager",   "https://www.logisticsmanager.com/feed/"),
]


def _is_relevant(title: str, summary: str) -> bool:
    """Quick keyword filter before paying for a Claude call."""
    text = (title + " " + summary).lower()
    return any(kw in text for kw in SUPPLY_CHAIN_KEYWORDS)


async def _fetch_rss_feed(name: str, url: str) -> list[dict]:
    """Fetch and parse an RSS feed. Returns list of {title, url, content, published_at, source}."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, follow_redirects=True)
            resp.raise_for_status()
        feed = feedparser.parse(resp.text)
        items = []
        for entry in feed.entries[:20]:  # cap at 20 per feed
            published = None
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                published = datetime(*entry.published_parsed[:6]).isoformat()
            items.append({
                "title": entry.get("title", ""),
                "url": entry.get("link", ""),
                "content": re.sub(r"<[^>]+>", "", entry.get("summary", "")),
                "published_at": published,
                "source": name,
            })
        return items
    except Exception:
        return []


async def _fetch_newsapi(query: str = "supply chain OR logistics OR commodity prices") -> list[dict]:
    """
    NewsAPI.org - returns top headlines for the query.
    Requires NEWS_API_KEY. Falls back to empty list if not configured.
    """
    if not settings.news_api_key:
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://newsapi.org/v2/everything",
                params={
                    "q": query,
                    "sortBy": "publishedAt",
                    "pageSize": 30,
                    "language": "en",
                    "apiKey": settings.news_api_key,
                },
            )
            resp.raise_for_status()
            data = resp.json()
        return [
            {
                "title": a["title"],
                "url": a["url"],
                "content": a.get("content") or a.get("description") or "",
                "published_at": a.get("publishedAt"),
                "source": a["source"]["name"],
            }
            for a in data.get("articles", [])
        ]
    except Exception:
        return []


async def get_supply_chain_news(
    org_context: str,
    limit: int = 20,
) -> list[dict]:
    """
    Main entry point. Fetches, filters, and enriches news with Claude analysis.

    org_context - short description of the org for personalised relevance scoring,
    e.g. "European electronics distributor with warehouses in London and Berlin"

    Returns list of enriched NewsItem dicts sorted by relevance_score desc.
    """
    # Fetch all sources in parallel
    tasks = [_fetch_rss_feed(name, url) for name, url in RSS_FEEDS]
    tasks.append(_fetch_newsapi())
    all_results = await asyncio.gather(*tasks)

    raw_articles: list[dict] = []
    for result in all_results:
        raw_articles.extend(result)

    # De-duplicate by URL
    seen_urls: set[str] = set()
    unique = []
    for a in raw_articles:
        if a["url"] not in seen_urls:
            seen_urls.add(a["url"])
            unique.append(a)

    # Keyword pre-filter to avoid paying for irrelevant Claude calls
    relevant = [a for a in unique if _is_relevant(a["title"], a["content"])]

    # Claude enrichment - run in batches of 5 to respect rate limits
    enriched = []
    for article in relevant[:30]:  # cap at 30 enrichments per call
        try:
            analysis = await analyse_news_article(
                title=article["title"],
                content=article["content"],
                org_context=org_context,
            )
            enriched.append({
                **article,
                "summary": analysis.get("summary", ""),
                "relevance_score": float(analysis.get("relevance_score", 0.5)),
                "impact": analysis.get("impact", "neutral"),
                "tags": analysis.get("tags", []),
            })
        except Exception:
            # Don't let one failed Claude call drop the whole feed
            enriched.append({
                **article,
                "summary": article["content"][:200],
                "relevance_score": 0.5,
                "impact": "neutral",
                "tags": [],
            })

    # Sort by relevance and return top N
    enriched.sort(key=lambda x: x["relevance_score"], reverse=True)
    return enriched[:limit]

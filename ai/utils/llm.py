"""
Anthropic Claude client - the intelligence layer of SUPPLIQ AI.

Claude is used for:
  - Summarising and scoring supply chain news articles
  - Generating natural-language reasoning for recommendations
  - Supplier risk narratives
  - Anomaly explanations
  - Smart replenishment justifications
  - Cash flow commentary
  - Free-form supply chain Q&A (future chat feature)
"""

import anthropic

from config import settings

_client: anthropic.AsyncAnthropic | None = None


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


def is_configured() -> bool:
    return bool(settings.anthropic_api_key)


async def analyse_news_article(title: str, content: str, org_context: str) -> dict:
    """
    Given a raw news article, asks Claude to:
    1. Summarise it in 2 sentences relevant to supply chain
    2. Assign a relevance score 0-1 for a business matching org_context
    3. Classify impact: positive | negative | neutral
    4. Extract tags: disruption, pricing, logistics, regulatory, demand, weather, etc.

    Returns: { summary, relevance_score, impact, tags }
    """
    client = get_client()
    prompt = f"""You are a supply chain intelligence analyst for a business described as: {org_context}

Article title: {title}
Article content: {content[:3000]}

Respond in JSON with these exact keys:
- "summary": 2-sentence summary relevant to supply chain operations
- "relevance_score": float 0.0-1.0 (how relevant to this business)
- "impact": one of "positive", "negative", "neutral"
- "tags": array of strings from [disruption, pricing, logistics, regulatory, demand, weather, competitor, currency, fuel, shortage]

Only return valid JSON, nothing else."""

    message = await client.messages.create(
        model=settings.claude_model,
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    import json
    return json.loads(message.content[0].text)


async def generate_reorder_reasoning(item: dict, stock: dict, forecast: dict) -> str:
    """
    Generates a plain-English explanation for why a reorder is recommended.
    e.g. "Based on your 30-day sales trend, you sell ~14 units/week.
          With 8 units remaining and an estimated lead time of 5 days,
          you will stock out in ~4 days. Order 60 units to cover 4 weeks."
    """
    client = get_client()
    prompt = f"""You are a supply chain advisor. Generate a concise 2-3 sentence reorder recommendation.

Item: {item['name']} (SKU: {item['sku']})
Current stock: {stock['stock_qty']} units at {stock['branch_name']}
Predicted demand next 30 days: {forecast['predicted_demand']} units
Confidence: {forecast['confidence_score']*100:.0f}%
Reorder point: {item.get('reorder_point', 'not set')}

Be specific with numbers. Be direct. No preamble."""

    message = await client.messages.create(
        model=settings.claude_model,
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()


async def score_supplier(supplier_name: str, metrics: dict) -> str:
    """
    Takes computed supplier metrics (avg lead time, price variance, fill rate, etc.)
    and returns a risk narrative + recommendation.
    """
    client = get_client()
    prompt = f"""You are a procurement analyst. Write a 3-sentence supplier assessment.

Supplier: {supplier_name}
Metrics:
- Average lead time: {metrics.get('avg_lead_days', 'unknown')} days
- Price variance across orders: {metrics.get('price_variance_pct', 'unknown')}%
- Order fill rate: {metrics.get('fill_rate_pct', 'unknown')}%
- Total orders analysed: {metrics.get('order_count', 0)}

End with one clear recommendation (diversify, maintain, prefer, or review).
Be specific and data-driven."""

    message = await client.messages.create(
        model=settings.claude_model,
        max_tokens=250,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()


async def explain_anomaly(anomaly_type: str, entity: str, data: dict) -> str:
    """Returns a plain-English explanation of a detected anomaly."""
    client = get_client()
    prompt = f"""You are a business analyst. Explain this anomaly in 2 sentences and suggest one action.

Anomaly type: {anomaly_type}
Entity: {entity}
Data: {data}

Be concise and actionable."""

    message = await client.messages.create(
        model=settings.claude_model,
        max_tokens=150,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()


async def generate_cash_flow_commentary(
    revenue_trend: list[dict],
    expense_summary: list[dict],
    projected_purchases: float,
) -> str:
    """
    Produces a short CFO-style commentary on cash flow outlook.
    Used in the dashboard insights panel.
    """
    client = get_client()
    prompt = f"""You are a CFO advisor. Write a 3-sentence cash flow commentary.

Revenue trend (last 30 days): {revenue_trend}
Expense breakdown: {expense_summary}
Upcoming purchase commitments: {projected_purchases:,.0f} (in org currency)

Focus on: trend direction, biggest cost driver, and one risk to watch.
Be specific with numbers."""

    message = await client.messages.create(
        model=settings.claude_model,
        max_tokens=250,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()

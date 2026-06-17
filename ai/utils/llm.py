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


async def generate_reorder_reasoning(
    item: dict,
    stock: dict,
    forecast: dict,
    currency: str = "EUR",
) -> str:
    """
    Generates a plain-English explanation for why a reorder is recommended.
    e.g. "Based on your 30-day sales trend, you sell ~14 units/week.
          With 8 units remaining and an estimated lead time of 5 days,
          you will stock out in ~4 days. Order 60 units to cover 4 weeks."
    """
    client = get_client()
    unit_cost = item.get("unit_cost")
    cost_line = f"Unit cost: {currency} {unit_cost:.2f}" if unit_cost else ""
    prompt = f"""You are a supply chain advisor. Generate a concise 2-3 sentence reorder recommendation.

Item: {item['name']} (SKU: {item['sku']})
Current stock: {stock['stock_qty']} units at {stock['branch_name']}
Predicted demand next 30 days: {forecast['predicted_demand']} units
Confidence: {forecast['confidence_score']*100:.0f}%
Reorder point: {item.get('reorder_point', 'not set')}
{cost_line}
Currency: {currency}

Be specific with numbers. Use {currency} for any monetary values. Be direct. No preamble."""

    message = await client.messages.create(
        model=settings.claude_model,
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()


async def score_supplier(
    supplier_name: str,
    metrics: dict,
    currency: str = "EUR",
) -> str:
    """
    Takes computed supplier metrics (avg lead time, price variance, fill rate, etc.)
    and returns a risk narrative + recommendation.
    """
    client = get_client()
    total_spend = metrics.get("total_spend")
    spend_line = f"- Total spend analysed: {currency} {total_spend:,.2f}" if total_spend else ""
    prompt = f"""You are a procurement analyst. Write a 3-sentence supplier assessment.

Supplier: {supplier_name}
Metrics:
- Average lead time: {metrics.get('avg_lead_days', 'unknown')} days
- Price variance across orders: {metrics.get('price_variance_pct', 'unknown')}%
- Order fill rate: {metrics.get('fill_rate_pct', 'unknown')}%
- Total orders analysed: {metrics.get('order_count', 0)}
{spend_line}
Currency: {currency}

End with one clear recommendation (diversify, maintain, prefer, or review).
Use {currency} for any monetary values. Be specific and data-driven."""

    message = await client.messages.create(
        model=settings.claude_model,
        max_tokens=250,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()


async def explain_anomaly(
    anomaly_type: str,
    entity: str,
    data: dict,
    currency: str = "EUR",
) -> dict:
    """
    Explains a detected anomaly in plain English and suggests one action.
    Returns {"explanation": str, "action": str}.
    Falls back to generic text if Claude is unavailable or returns invalid JSON.
    """
    client = get_client()
    prompt = f"""You are a business analyst for a retail/wholesale business.
Explain this anomaly in 2 sentences and suggest exactly one concrete action.

Anomaly type: {anomaly_type}
Entity: {entity}
Data: {data}
Currency: {currency}

Return only valid JSON (no markdown, no preamble):
{{"explanation": "2-sentence plain-English explanation of what happened and why it is unusual", "action": "one short concrete action the manager should take"}}

Use {currency} for monetary values. Be specific with the numbers from Data."""

    try:
        import json
        message = await client.messages.create(
            model=settings.claude_model,
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}],
        )
        text = message.content[0].text.strip()
        # strip markdown code fences if Claude adds them
        if text.startswith("```"):
            text = text.split("```")[1].lstrip("json").strip()
        return json.loads(text)
    except Exception:
        return {
            "explanation": f"Anomaly detected for {entity}: {anomaly_type}.",
            "action": "Review the affected records and investigate.",
        }


async def generate_weekly_briefing_prose(
    org_name: str,
    week_start: str,
    stockout_risks: list[dict],
    biggest_anomaly: dict | None,
    supplier_to_watch: dict | None,
    currency: str = "EUR",
) -> dict:
    """
    Writes a Monday morning briefing entirely in prose — no tables, no bullets.
    Returns {"prose": str, "recommendation": str}.
    """
    client = get_client()

    stockout_text = (
        "\n".join(
            f"  - {r['item_name']} ({r.get('sku', '')}) at {r.get('branch', 'main branch')}: "
            f"{r['days_left']} days of stock left ({r['stock_qty']} units)"
            for r in stockout_risks
        )
        or "  No items critically low on stock."
    )
    anomaly_text = (
        f"  Type: {biggest_anomaly.get('type', 'unknown')}\n"
        f"  Entity: {biggest_anomaly.get('entity_name', '?')}\n"
        f"  Severity: {biggest_anomaly.get('severity', '?')}\n"
        f"  Detail: {biggest_anomaly.get('description', '')}"
        if biggest_anomaly
        else "  No anomalies detected last week."
    )
    supplier_text = (
        f"  {supplier_to_watch['supplier_name']}: avg {supplier_to_watch['avg_lead_days']} days "
        f"across {supplier_to_watch['order_count']} orders"
        if supplier_to_watch
        else "  No supplier concerns flagged."
    )

    prompt = f"""You are the AI business advisor for {org_name}.
Write a Monday morning briefing for the admin covering the week of {week_start}.

Rules:
- Plain prose only — no bullet points, no numbered lists, no headers, no bold, no markdown.
- Exactly 4 short paragraphs (2-3 sentences each).
- Use "your business" or "your team", not "the business".
- Be specific with the numbers given below. Use {currency} for money.

Data:
Top stockout risks:
{stockout_text}

Biggest anomaly last week:
{anomaly_text}

Supplier to watch:
{supplier_text}

Write the 4 paragraphs in this order:
1. Open with the most urgent stockout risk — name the item, how many days of stock remain, and why it needs action this week.
2. Describe what the anomaly means for the business and what likely caused it.
3. Address the supplier situation and what it means for upcoming orders.
4. Give ONE specific operational recommendation — a concrete action the admin should take today or this week.

After the 4 paragraphs, output a single line starting with "RECOMMENDATION:" followed by a 1-sentence summary of the action from paragraph 4. This line is for structured extraction only.

Output only the 4 paragraphs and the RECOMMENDATION: line. Nothing else."""

    message = await client.messages.create(
        model=settings.claude_model,
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text.strip()

    # Split prose from the structured recommendation line
    lines = raw.splitlines()
    rec_line = next((l for l in reversed(lines) if l.startswith("RECOMMENDATION:")), None)
    if rec_line:
        recommendation = rec_line.replace("RECOMMENDATION:", "").strip()
        prose = "\n\n".join(
            p.strip() for p in "\n".join(
                l for l in lines if not l.startswith("RECOMMENDATION:")
            ).split("\n\n") if p.strip()
        )
    else:
        prose = raw
        recommendation = ""

    return {"prose": prose, "recommendation": recommendation}


async def generate_cash_flow_commentary(
    revenue_trend: list[dict],
    expense_summary: list[dict],
    projected_purchases: float,
    projected_revenue_30d: float = 0.0,
    projected_net_30d: float = 0.0,
    currency: str = "EUR",
) -> str:
    """
    Produces a CFO-style 3-sentence commentary on the 30-day cash flow outlook.
    """
    client = get_client()
    total_expenses = sum(float(e.get("total", 0)) for e in expense_summary)
    top_expense = max(expense_summary, key=lambda e: float(e.get("total", 0)), default={})
    prompt = f"""You are a CFO advisor for a retail/wholesale business.
Write exactly 3 sentences of cash flow commentary covering: (1) the 30-day revenue outlook and trend, (2) the biggest cost driver and purchase commitments, (3) the key risk or opportunity to act on.

30-day projections:
- Projected revenue:    {currency} {projected_revenue_30d:,.0f}
- Expense run rate:     {currency} {total_expenses:,.0f}
- Purchase commitments: {currency} {projected_purchases:,.0f}
- Net cash position:    {currency} {projected_net_30d:,.0f} ({'surplus' if projected_net_30d >= 0 else 'deficit'})
- Largest expense category: {top_expense.get('category', 'N/A')} ({currency} {float(top_expense.get('total', 0)):,.0f})

Recent daily revenue (last 7 days): {[{'date': str(r.get('date', '')), 'revenue': round(float(r.get('revenue', 0)), 0)} for r in revenue_trend[-7:]]}

Use {currency} for all monetary values. Be direct, specific, and data-driven. 3 sentences only."""

    message = await client.messages.create(
        model=settings.claude_model,
        max_tokens=250,
        messages=[{"role": "user", "content": prompt}],
    )
    return message.content[0].text.strip()

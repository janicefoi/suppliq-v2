"""
SUPPLIQ AI — Endpoint Health Checker
=====================================
Hits every FastAPI endpoint and prints a readable summary of what came back.

Usage (from inside ai/ with the venv active):
    python test_endpoints.py

The script auto-discovers the demo org from the database.
Make sure the AI service is running first:
    python -m uvicorn main:app --reload --port 8000
"""

import asyncio
import json
import os
import sys
import textwrap

import httpx
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv("AI_SERVICE_URL", "http://localhost:8000")
DEMO_EMAIL = "demo@suppliq.com"
FAKE_ORG_ID = "seed-org-meridian"

# ── ANSI colours ──────────────────────────────────────────────────────────────
G    = "\033[92m"
R    = "\033[91m"
Y    = "\033[93m"
B    = "\033[94m"
C    = "\033[96m"
BOLD = "\033[1m"
DIM  = "\033[2m"
RST  = "\033[0m"

passed_count = 0
failed_count = 0


# ── DB helper ─────────────────────────────────────────────────────────────────

async def get_demo_org() -> tuple[str, str]:
    try:
        import asyncpg  # type: ignore
        conn = await asyncpg.connect(dsn=os.getenv("DATABASE_URL", ""))
        row = await conn.fetchrow(
            """
            SELECT o.id, o.name, o.currency
            FROM organizations o
            JOIN users u ON u.organization_id = o.id
            WHERE u.email = $1
            LIMIT 1
            """,
            DEMO_EMAIL,
        )
        await conn.close()
        if row:
            return str(row["id"]), f"{row['name']} ({row['currency']})"
    except Exception as exc:
        print(f"  {Y}DB unreachable ({exc}) — using hard-coded seed ID{RST}")
    return FAKE_ORG_ID, "Meridian Electronics Ltd (seed)"


# ── Print helpers ─────────────────────────────────────────────────────────────

def _sep(title: str) -> None:
    print(f"\n  {BOLD}{C}── {title} {'─' * (44 - len(title))}{RST}")


def _row(label: str, value: str, colour: str = DIM) -> None:
    print(f"     {BOLD}{label:<22}{RST} {colour}{value}{RST}")


def _ok(label: str) -> None:
    global passed_count
    passed_count += 1
    print(f"\n  {G}{BOLD} ✓ {RST}{BOLD}{label}{RST}")


def _fail(label: str, reason: str) -> None:
    global failed_count
    failed_count += 1
    print(f"\n  {R}{BOLD} ✗ {RST}{BOLD}{label}{RST}")
    print(f"     {R}{reason[:200]}{RST}")


def _warn(msg: str) -> None:
    print(f"     {Y}{msg}{RST}")


def _clip(text: str, n: int = 90) -> str:
    text = str(text).strip()
    return (text[:n] + "…") if len(text) > n else text


# ── Request helper ────────────────────────────────────────────────────────────

async def get(client: httpx.AsyncClient, path: str, label: str) -> dict | None:
    url = f"{BASE_URL}{path}"
    try:
        resp = await client.get(url, timeout=30)
        if resp.status_code >= 500:
            _fail(label, f"HTTP {resp.status_code} — {resp.text[:200]}")
            return None
        _ok(label)
        return resp.json()
    except httpx.ConnectError:
        _fail(label, f"Connection refused — is the AI service running at {BASE_URL}?")
        return None
    except Exception as exc:
        _fail(label, str(exc))
        return None


async def post(client: httpx.AsyncClient, path: str, body: dict, label: str) -> dict | None:
    url = f"{BASE_URL}{path}"
    try:
        resp = await client.post(url, json=body, timeout=30)
        if resp.status_code >= 500:
            _fail(label, f"HTTP {resp.status_code} — {resp.text[:200]}")
            return None
        _ok(label)
        return resp.json()
    except httpx.ConnectError:
        _fail(label, f"Connection refused — is the AI service running at {BASE_URL}?")
        return None
    except Exception as exc:
        _fail(label, str(exc))
        return None


# ── Response renderers ────────────────────────────────────────────────────────

def render_health(d: dict) -> None:
    status = d.get("status", "?")
    colour = G if status == "ok" else Y
    _row("status",           status,                          colour)
    _row("version",          d.get("version", "?"))
    _row("db_connected",     str(d.get("db_connected")),      G if d.get("db_connected") else R)
    _row("claude_configured",str(d.get("claude_configured")), G if d.get("claude_configured") else R)
    _row("timestamp",        d.get("timestamp", "?"))
    if status != "ok":
        _warn("Service is degraded — check ANTHROPIC_API_KEY and DATABASE_URL in ai/.env")


def render_demand(d: dict) -> None:
    forecasts = d.get("forecasts") or d.get("data") or []
    if isinstance(d, dict) and "organization_id" in d:
        _row("organization_id", d["organization_id"])
    _row("forecasts returned", str(len(forecasts)))
    for f in forecasts[:3]:
        item_name = f.get("item_name") or f.get("item_id", "?")
        avg = f.get("average_daily_demand") or f.get("avg_daily", "?")
        total = f.get("total_forecasted_demand") or f.get("total", "?")
        _row(f"  {_clip(item_name, 20)}", f"avg/day={avg}  total={total}")
    if len(forecasts) > 3:
        _row("", f"… and {len(forecasts) - 3} more items")


def render_cash_flow(d: dict) -> None:
    _row("currency",  d.get("currency", "?"))
    _row("period",    f"{d.get('start_date','?')} → {d.get('end_date','?')}")
    _row("projected revenue",   str(d.get("projected_revenue",   "?")))
    _row("projected expenses",  str(d.get("projected_expenses",  "?")))
    _row("projected net",       str(d.get("projected_net",       "?")))
    commentary = d.get("commentary") or d.get("summary") or ""
    if commentary:
        _row("commentary", "")
        for line in textwrap.wrap(commentary, 70):
            print(f"       {DIM}{line}{RST}")


def render_news(d: dict) -> None:
    articles = d.get("articles") or d.get("items") or (d if isinstance(d, list) else [])
    _row("articles returned", str(len(articles)))
    for i, a in enumerate(articles[:5], 1):
        title  = a.get("title") or a.get("headline", "?")
        score  = a.get("relevance_score") or a.get("score", "?")
        source = a.get("source") or a.get("publisher", "?")
        _row(f"  {i}. {_clip(title, 35)}", f"relevance={score}  [{source}]")


def render_market(d: dict) -> None:
    base  = d.get("base_currency", "?")
    rates = d.get("rates") or d.get("fx_rates") or {}
    cmty  = d.get("commodities") or d.get("commodity_prices") or {}
    _row("base currency", base)
    _row("FX pairs", str(len(rates)))
    for pair, rate in list(rates.items())[:5]:
        _row(f"  {pair}", str(rate))
    if cmty:
        _row("commodities", str(len(cmty)))
        for name, val in list(cmty.items())[:3]:
            _row(f"  {name}", str(val))


def render_supplier_scores(d: dict) -> None:
    scores = d.get("scores") or d.get("suppliers") or (d if isinstance(d, list) else [])
    _row("suppliers scored", str(len(scores)))
    for s in scores:
        name  = s.get("name") or s.get("supplier_name", "?")
        score = s.get("score") or s.get("reliability_score", "?")
        grade = s.get("grade") or s.get("rating", "")
        colour = G if isinstance(score, (int, float)) and score >= 70 else (Y if isinstance(score, (int, float)) and score >= 40 else R)
        _row(f"  {_clip(name, 22)}", f"{score}  {grade}", colour)


def render_reorder(d: dict) -> None:
    recs = d.get("recommendations") or d.get("items") or (d if isinstance(d, list) else [])
    _row("recommendations", str(len(recs)))
    for r in recs[:5]:
        name     = r.get("item_name") or r.get("name", "?")
        priority = r.get("priority", "?")
        days_out = r.get("days_until_stockout") or r.get("days_out", "?")
        qty      = r.get("suggested_order_qty") or r.get("order_qty", "?")
        colour   = R if str(priority).lower() == "critical" else (Y if str(priority).lower() == "high" else DIM)
        _row(f"  {_clip(name, 20)}", f"priority={priority}  stockout_in={days_out}d  order={qty}", colour)
    if len(recs) > 5:
        _row("", f"… and {len(recs) - 5} more")


def render_anomalies(d: dict) -> None:
    anomalies = d.get("anomalies") or d.get("items") or (d if isinstance(d, list) else [])
    _row("anomalies found", str(len(anomalies)))
    for a in anomalies[:6]:
        atype    = a.get("type") or a.get("anomaly_type", "?")
        severity = a.get("severity") or a.get("level", "?")
        entity   = a.get("entity") or a.get("item") or a.get("supplier", "?")
        colour   = R if str(severity).lower() == "critical" else (Y if str(severity).lower() == "warning" else DIM)
        _row(f"  [{severity}] {_clip(atype, 18)}", _clip(str(entity), 40), colour)


# ── Main ──────────────────────────────────────────────────────────────────────

async def main() -> None:
    print(f"\n{BOLD}{'═' * 55}{RST}")
    print(f"{BOLD}  SUPPLIQ AI  ·  Endpoint Checker{RST}")
    print(f"{BOLD}{'═' * 55}{RST}")
    print(f"  {DIM}target  {RST}{B}{BASE_URL}{RST}")
    print(f"  {DIM}docs    {RST}{B}{BASE_URL}/docs{RST}")

    print(f"\n  {DIM}Looking up demo org…{RST}")
    org_id, org_label = await get_demo_org()
    print(f"  {DIM}org     {RST}{B}{org_label}{RST}")
    print(f"  {DIM}org_id  {RST}{DIM}{org_id}{RST}")

    async with httpx.AsyncClient() as client:

        # ── Core ──────────────────────────────────────────────────────────
        _sep("CORE")

        d = await get(client, "/", "Root")
        if d:
            _row("service", d.get("service", "?"))
            _row("docs",    d.get("docs", "?"))

        d = await get(client, "/health", "Health check")
        if d:
            render_health(d)

        # ── Forecasting ───────────────────────────────────────────────────
        _sep("FORECASTING")

        d = await post(
            client, "/forecast/demand",
            {"organization_id": org_id, "horizon_days": 30},
            "Demand forecast — 30 days",
        )
        if d:
            render_demand(d)

        d = await get(client, f"/forecast/cash-flow/{org_id}", "Cash flow forecast")
        if d:
            render_cash_flow(d)

        # ── Intelligence ──────────────────────────────────────────────────
        _sep("MARKET INTELLIGENCE")

        d = await get(
            client,
            f"/intelligence/news?organization_id={org_id}&limit=5",
            "Supply chain news — 5 articles",
        )
        if d:
            render_news(d)

        d = await get(client, f"/intelligence/market-prices/{org_id}", "Market prices & FX")
        if d:
            render_market(d)

        d = await get(client, f"/intelligence/supplier-scores/{org_id}", "Supplier scores")
        if d:
            render_supplier_scores(d)

        # ── Optimization ──────────────────────────────────────────────────
        _sep("OPTIMIZATION")

        d = await get(client, f"/optimize/reorder/{org_id}", "Reorder recommendations")
        if d:
            render_reorder(d)

        # ── Anomaly Detection ─────────────────────────────────────────────
        _sep("ANOMALY DETECTION")

        d = await get(client, f"/anomalies/{org_id}", "Anomaly detection")
        if d:
            render_anomalies(d)

    # ── Summary ───────────────────────────────────────────────────────────────
    total  = passed_count + failed_count
    colour = G if failed_count == 0 else (Y if passed_count > 0 else R)
    print(f"\n  {BOLD}{'═' * 55}{RST}")
    print(f"  {colour}{BOLD}{passed_count}/{total} endpoints passed{RST}", end="")
    if failed_count:
        print(f"  {R}({failed_count} failed){RST}", end="")
    print(f"\n  {BOLD}{'═' * 55}{RST}\n")

    sys.exit(0 if failed_count == 0 else 1)


if __name__ == "__main__":
    asyncio.run(main())

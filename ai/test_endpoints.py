"""
SUPPLIQ AI — Endpoint Health Checker
=====================================
Hits every FastAPI endpoint with real or fake payloads and reports pass/fail.

Run from the ai/ directory with the venv active:
    python test_endpoints.py

Optional env overrides:
    AI_SERVICE_URL=http://localhost:8000   (default)
    DATABASE_URL=...                       (read from .env automatically)
"""

import asyncio
import os
import sys

import httpx
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv("AI_SERVICE_URL", "http://localhost:8000")
FAKE_ORG_ID = "00000000-0000-0000-0000-000000000000"

# ANSI colours
G = "\033[92m"
R = "\033[91m"
Y = "\033[93m"
B = "\033[94m"
BOLD = "\033[1m"
DIM  = "\033[2m"
RST  = "\033[0m"


# ── Helpers ────────────────────────────────────────────────────────────────

async def get_org_id() -> tuple[str, str]:
    """Return (org_id, org_name) from the DB, or fall back to a fake value."""
    try:
        import asyncpg  # type: ignore
        db_url = os.getenv("DATABASE_URL", "")
        conn = await asyncpg.connect(dsn=db_url)
        row = await conn.fetchrow("SELECT id, name FROM organizations LIMIT 1")
        await conn.close()
        if row:
            return str(row["id"]), str(row["name"])
    except Exception as exc:
        print(f"  {Y}DB lookup failed ({exc}) — using fake org ID{RST}")
    return FAKE_ORG_ID, "fake-org"


def _badge(ok: bool) -> str:
    return f"{G}{BOLD} PASS {RST}" if ok else f"{R}{BOLD} FAIL {RST}"


async def check(
    client: httpx.AsyncClient,
    method: str,
    path: str,
    *,
    body: dict | None = None,
    label: str = "",
) -> bool:
    url = f"{BASE_URL}{path}"
    label = label or f"{method} {path}"
    try:
        if method == "GET":
            resp = await client.get(url, timeout=20)
        else:
            resp = await client.post(url, json=body or {}, timeout=20)

        passed = resp.status_code < 500
        print(f"  {_badge(passed)} {label}")
        print(f"         {DIM}{method} {path}  →  {resp.status_code}{RST}")

        if not passed:
            snippet = resp.text[:300].strip()
            print(f"         {R}{snippet}{RST}")
        else:
            # Show a tiny slice of the response so we can see it's real data
            try:
                data = resp.json()
                if isinstance(data, dict):
                    keys = list(data.keys())[:6]
                    print(f"         {DIM}keys: {keys}{RST}")
            except Exception:
                pass

        return passed

    except httpx.ConnectError:
        print(f"  {_badge(False)} {label}")
        print(f"         {R}Connection refused — is the AI service running at {BASE_URL}?{RST}")
        return False
    except Exception as exc:
        print(f"  {_badge(False)} {label}")
        print(f"         {R}{exc}{RST}")
        return False


# ── Main ───────────────────────────────────────────────────────────────────

async def main() -> None:
    print(f"\n{BOLD}{'─' * 55}{RST}")
    print(f"{BOLD}  SUPPLIQ AI  ·  Endpoint Health Checks{RST}")
    print(f"{BOLD}{'─' * 55}{RST}")
    print(f"  Target : {B}{BASE_URL}{RST}")

    print(f"\n  {DIM}Fetching org from database…{RST}")
    org_id, org_name = await get_org_id()
    print(f"  Org    : {B}{org_name}{RST}  {DIM}({org_id}){RST}\n")

    results: list[bool] = []

    async with httpx.AsyncClient() as client:

        print(f"  {BOLD}── Core ──────────────────────────────────────────{RST}")
        results.append(await check(client, "GET", "/",       label="Root"))
        results.append(await check(client, "GET", "/health", label="Health"))

        print(f"\n  {BOLD}── Forecasting ───────────────────────────────────{RST}")
        results.append(await check(
            client, "POST", "/forecast/demand",
            body={"organization_id": org_id, "horizon_days": 30},
            label="Demand forecast (30 days)",
        ))
        results.append(await check(
            client, "GET", f"/forecast/cash-flow/{org_id}",
            label="Cash flow forecast",
        ))

        print(f"\n  {BOLD}── Intelligence ──────────────────────────────────{RST}")
        results.append(await check(
            client, "GET",
            f"/intelligence/news?organization_id={org_id}&limit=3",
            label="Supply chain news (3 articles)",
        ))
        results.append(await check(
            client, "GET", f"/intelligence/market-prices/{org_id}",
            label="Market prices & FX",
        ))
        results.append(await check(
            client, "GET", f"/intelligence/supplier-scores/{org_id}",
            label="Supplier reliability scores",
        ))

        print(f"\n  {BOLD}── Optimization ──────────────────────────────────{RST}")
        results.append(await check(
            client, "GET", f"/optimize/reorder/{org_id}",
            label="Reorder recommendations",
        ))

        print(f"\n  {BOLD}── Anomaly Detection ─────────────────────────────{RST}")
        results.append(await check(
            client, "GET", f"/anomalies/{org_id}",
            label="Anomaly detection",
        ))

    # ── Summary ───────────────────────────────────────────────────────────
    passed = sum(results)
    total  = len(results)
    colour = G if passed == total else (Y if passed > 0 else R)

    print(f"\n  {BOLD}{'─' * 55}{RST}")
    print(f"  {colour}{BOLD}{passed}/{total} endpoints passed{RST}")
    print(f"  {BOLD}{'─' * 55}{RST}\n")

    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    asyncio.run(main())

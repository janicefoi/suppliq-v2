"use client";

import { useRouter } from "next/navigation";
import {
  Globe, Wifi, RefreshCw, ExternalLink,
  TrendingUp, TrendingDown, Minus, AlertTriangle,
  Newspaper, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  NewsArticle,
  CommodityPrice,
  PriceAlert,
} from "@/app/(dashboard)/insights/market/page";

// ── Tag colours (maps Claude tags → chip style) ────────────────────────────

const TAG_STYLE: Record<string, string> = {
  disruption:  "bg-red-100 text-red-700",
  pricing:     "bg-amber-100 text-amber-700",
  logistics:   "bg-blue-100 text-blue-700",
  regulatory:  "bg-purple-100 text-purple-700",
  demand:      "bg-green-100 text-green-700",
  weather:     "bg-sky-100 text-sky-700",
  competitor:  "bg-orange-100 text-orange-700",
  currency:    "bg-indigo-100 text-indigo-700",
  fuel:        "bg-yellow-100 text-yellow-700",
  shortage:    "bg-rose-100 text-rose-700",
};

const IMPACT_STYLE: Record<string, string> = {
  positive: "bg-green-100 text-green-700",
  negative: "bg-red-100 text-red-700",
  neutral:  "bg-slate-100 text-slate-500",
};

const COMMODITY_LABEL: Record<string, string> = {
  brent_crude:  "Brent Crude",
  wti_crude:    "WTI Crude",
  natural_gas:  "Natural Gas",
  copper:       "Copper",
  aluminum:     "Aluminium",
  wheat:        "Wheat",
  corn:         "Corn",
  sugar:        "Sugar",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function fmtPrice(n: number, decimals = 2): string {
  return n.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ── Change indicator ───────────────────────────────────────────────────────

function ChangeChip({ pct }: { pct: number | null }) {
  if (pct === null || pct === undefined) return <span className="text-[10px] text-slate-400">—</span>;
  const up = pct > 0;
  const flat = pct === 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded",
        flat ? "text-slate-500 bg-slate-100"
          : up ? "text-green-700 bg-green-100"
          : "text-red-700 bg-red-100"
      )}
    >
      {flat ? <Minus className="h-2.5 w-2.5" /> : up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {pct > 0 ? "+" : ""}{pct.toFixed(2)}%
    </span>
  );
}

// ── News article card ──────────────────────────────────────────────────────

function ArticleCard({ article }: { article: NewsArticle }) {
  const impactStyle = IMPACT_STYLE[article.impact] ?? IMPACT_STYLE.neutral;
  const relevancePct = Math.round(article.relevance_score * 100);

  return (
    <article className="border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
            {article.source}
          </span>
          {article.published_at && (
            <span className="text-[10px] text-slate-300">{fmtDate(article.published_at)}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded", impactStyle)}>
            {article.impact}
          </span>
          <span className="text-[9px] text-slate-400 tabular-nums">{relevancePct}%</span>
        </div>
      </div>

      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group"
      >
        <h3 className="text-sm font-semibold text-slate-800 leading-snug mb-1.5 group-hover:text-blue-600 transition-colors flex items-start gap-1">
          {article.title}
          <ExternalLink className="h-3 w-3 shrink-0 mt-0.5 text-slate-300 group-hover:text-blue-400" />
        </h3>
      </a>

      {article.summary && (
        <p className="text-xs text-slate-600 leading-relaxed mb-2">{article.summary}</p>
      )}

      {article.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {article.tags.map((tag) => (
            <span
              key={tag}
              className={cn(
                "text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded",
                TAG_STYLE[tag] ?? "bg-slate-100 text-slate-500"
              )}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

// ── Price card (commodity or FX) ───────────────────────────────────────────

function PriceCard({
  label, price, unit, changePct, source,
}: {
  label: string;
  price: number;
  unit: string;
  changePct: number | null;
  source?: string;
}) {
  return (
    <div className="border border-slate-200 rounded-lg px-3 py-2.5">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <div className="flex items-end gap-1.5 flex-wrap">
        <span className="text-base font-bold tabular-nums text-slate-800">
          {fmtPrice(price)}
        </span>
        <span className="text-[10px] text-slate-400 mb-0.5">{unit}</span>
      </div>
      <div className="flex items-center gap-1.5 mt-1">
        <ChangeChip pct={changePct} />
        {source && (
          <span className="text-[9px] text-slate-300 ml-auto">{source}</span>
        )}
      </div>
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  articles: NewsArticle[];
  commodities: Record<string, CommodityPrice>;
  fxRates: Record<string, CommodityPrice>;
  alerts: PriceAlert[];
  baseCurrency: string;
  fetchedAt: string | null;
  unavailable: boolean;
  newsUnavailable: boolean;
  marketUnavailable: boolean;
}

// ── Main component ──────────────────────────────────────────────────────────

export function MarketClient({
  articles, commodities, fxRates, alerts, baseCurrency,
  fetchedAt, unavailable, newsUnavailable, marketUnavailable,
}: Props) {
  const router = useRouter();

  // ── Offline (both failed) ─────────────────────────────────────────────────
  if (unavailable) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
        <Wifi className="h-10 w-10 text-slate-300" />
        <h3 className="font-semibold text-slate-600">AI service is offline</h3>
        <p className="text-sm text-slate-400 max-w-sm">
          Start it with <code className="bg-slate-100 px-1 rounded text-xs">uvicorn main:app --port 8000</code> inside <code className="bg-slate-100 px-1 rounded text-xs">ai/</code>, then refresh.
        </p>
        <Button variant="outline" size="sm" className="gap-1.5 mt-2" onClick={() => router.refresh()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  const hasCommodities = Object.keys(commodities).length > 0;
  const hasFx          = Object.keys(fxRates).length > 0;
  const hasMarketData  = hasCommodities || hasFx;

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Globe className="h-5 w-5 text-blue-500" />
          Market Intelligence
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Curated supply chain news scored for your industry
          {hasMarketData && ` · live commodity prices and ${baseCurrency} exchange rates`}
          {fetchedAt && (
            <span className="ml-2 text-slate-400">
              · updated {fmtDate(fetchedAt)}
            </span>
          )}
        </p>
      </div>

      {/* ── Price alerts strip ──────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className={cn(
          "rounded-xl border px-4 py-3 flex items-start gap-3",
          alerts.some(a => a.severity === "warning")
            ? "border-amber-200 bg-amber-50"
            : "border-blue-200 bg-blue-50"
        )}>
          <AlertTriangle className={cn(
            "h-4 w-4 shrink-0 mt-0.5",
            alerts.some(a => a.severity === "warning") ? "text-amber-500" : "text-blue-500"
          )} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1">
              Price movement alerts
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5">
              {alerts.map((a, i) => (
                <span key={i} className="text-xs text-amber-900">{a.message}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Main grid: news left, market right ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">

        {/* News feed */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Newspaper className="h-4 w-4 text-slate-400" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Top stories · relevance-ranked for your industry
            </p>
          </div>

          {newsUnavailable ? (
            <div className="flex flex-col items-center justify-center py-12 border border-slate-200 rounded-xl text-center gap-2">
              <Wifi className="h-6 w-6 text-slate-300" />
              <p className="text-sm text-slate-400">News feed unavailable</p>
            </div>
          ) : articles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border border-slate-200 rounded-xl text-center gap-2">
              <Newspaper className="h-6 w-6 text-slate-300" />
              <p className="text-sm text-slate-400">No articles available from RSS feeds right now.</p>
              <p className="text-xs text-slate-300">
                Add a NEWS_API_KEY to env for broader coverage.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {articles.map((a, i) => (
                <ArticleCard key={`${a.url}-${i}`} article={a} />
              ))}
              <p className="text-[10px] text-slate-400 text-center pt-1">
                Scored and summarised by Claude · cached 2 hours · sources: Reuters, Supply Chain Dive, FreightWaves, Logistics Manager
              </p>
            </div>
          )}
        </div>

        {/* Market data */}
        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-slate-400" />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Commodity prices
              </p>
            </div>
            {marketUnavailable ? (
              <div className="text-xs text-slate-400 border border-slate-200 rounded-xl p-4 text-center">
                Market data unavailable
              </div>
            ) : !hasCommodities ? (
              <div className="text-xs text-slate-400 border border-slate-200 rounded-xl p-4 text-center leading-relaxed">
                No commodity data.
                <br />Configure <code className="bg-slate-100 px-1 rounded">ALPHA_VANTAGE_API_KEY</code> to see live prices.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(commodities).map(([key, data]) => (
                  <PriceCard
                    key={key}
                    label={COMMODITY_LABEL[key] ?? key.replace(/_/g, " ")}
                    price={data.price}
                    unit={data.currency ?? "USD"}
                    changePct={data.change_pct_24h}
                    source={data.source}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Globe className="h-4 w-4 text-slate-400" />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                FX rates · {baseCurrency} base
              </p>
            </div>
            {!hasFx ? (
              <div className="text-xs text-slate-400 border border-slate-200 rounded-xl p-4 text-center leading-relaxed">
                No FX data.
                <br />Configure <code className="bg-slate-100 px-1 rounded">ALPHA_VANTAGE_API_KEY</code>.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(fxRates).map(([pair, data]) => (
                  <PriceCard
                    key={pair}
                    label={pair}
                    price={data.price}
                    unit={pair.split("/")[1] ?? ""}
                    changePct={data.change_pct_24h}
                    source={data.source}
                  />
                ))}
              </div>
            )}
          </div>

          {hasMarketData && (
            <p className="text-[10px] text-slate-400">
              Prices from Alpha Vantage (free tier: 25 req/day).
              24h change shown where available.
              FX pairs auto-selected for your org&apos;s base currency.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

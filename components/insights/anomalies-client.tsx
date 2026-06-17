"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldAlert, Wifi, RefreshCw, AlertCircle, AlertTriangle,
  TrendingUp, TrendingDown, Package, Receipt, ChevronDown, ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import type { AnomalyRecord } from "@/app/(dashboard)/insights/anomalies/page";

// ── Type config ─────────────────────────────────────────────────────────────

const TYPE_CFG = {
  sales_spike: {
    label:  "Sales spike",
    icon:   TrendingUp,
    colour: "text-emerald-600",
    bg:     "bg-emerald-50 border-emerald-200",
  },
  sales_drop: {
    label:  "Sales drop",
    icon:   TrendingDown,
    colour: "text-rose-600",
    bg:     "bg-rose-50 border-rose-200",
  },
  stock_shrinkage: {
    label:  "Stock shrinkage",
    icon:   Package,
    colour: "text-amber-600",
    bg:     "bg-amber-50 border-amber-200",
  },
  expense_outlier: {
    label:  "Expense outlier",
    icon:   Receipt,
    colour: "text-purple-600",
    bg:     "bg-purple-50 border-purple-200",
  },
} as const satisfies Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; colour: string; bg: string }>;

const SEV_CFG = {
  critical: { badge: "bg-red-100 text-red-700 border-red-300",    ring: "border-red-300" },
  warning:  { badge: "bg-amber-100 text-amber-700 border-amber-300", ring: "border-amber-200" },
} as const;

// ── Raw-data formatter ──────────────────────────────────────────────────────

function RawDataChips({ type, data, currency }: { type: AnomalyRecord["type"]; data: Record<string, unknown>; currency: string }) {
  if (type === "sales_spike" || type === "sales_drop") {
    return (
      <div className="flex flex-wrap gap-1.5 mt-2">
        <Chip label="Recent (7d)" value={`${data.recent_7d_qty} units`} />
        <Chip label="Recent rate" value={`${data.recent_daily_rate}/day`} />
        <Chip label="Baseline rate" value={`${data.baseline_daily_rate}/day`} />
        <Chip label="Ratio" value={`${data.ratio}×`} highlight />
      </div>
    );
  }
  if (type === "stock_shrinkage") {
    return (
      <div className="flex flex-wrap gap-1.5 mt-2">
        <Chip label="Units lost" value={`${data.units_lost} units`} highlight />
        <Chip label="Adjustments" value={`${data.adjustments} records`} />
        {Number(data.unit_cost) > 0 && (
          <Chip label="Est. value" value={formatCurrency(Number(data.estimated_value), currency)} highlight />
        )}
      </div>
    );
  }
  if (type === "expense_outlier") {
    return (
      <div className="flex flex-wrap gap-1.5 mt-2">
        <Chip label="This month" value={formatCurrency(Number(data.recent_30d), currency)} highlight />
        <Chip label="Normal avg" value={formatCurrency(Number(data.baseline_30d_avg), currency)} />
        <Chip label="Multiple" value={`${data.ratio}×`} highlight />
      </div>
    );
  }
  return null;
}

function Chip({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] border",
      highlight
        ? "bg-slate-800 text-white border-slate-700 font-semibold"
        : "bg-slate-50 text-slate-600 border-slate-200",
    )}>
      <span className="text-[9px] uppercase tracking-wide opacity-60">{label}</span>
      {value}
    </span>
  );
}

// ── Single anomaly card ─────────────────────────────────────────────────────

function AnomalyCard({ anomaly, currency }: { anomaly: AnomalyRecord; currency: string }) {
  const [expanded, setExpanded] = useState(false);
  const cfg    = TYPE_CFG[anomaly.type] ?? TYPE_CFG.expense_outlier;
  const sevCfg = SEV_CFG[anomaly.severity];
  const Icon   = cfg.icon;

  return (
    <div className={cn("rounded-xl border p-4 space-y-2 transition-shadow hover:shadow-sm", cfg.bg, sevCfg.ring)}>
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 shrink-0", cfg.colour)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-[10px] font-bold border rounded px-1.5 py-0.5", sevCfg.badge)}>
              {anomaly.severity.toUpperCase()}
            </span>
            <span className="text-xs font-semibold text-slate-500">{cfg.label}</span>
          </div>
          <p className="mt-0.5 font-semibold text-slate-800 text-sm">{anomaly.entity_name}</p>
          {anomaly.sku && <p className="text-[10px] font-mono text-slate-400">{anomaly.sku}</p>}
          {anomaly.branch_name && (
            <p className="text-[10px] text-slate-500">{anomaly.branch_name}</p>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-white/60 transition-colors"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Raw data chips */}
      <RawDataChips type={anomaly.type} data={anomaly.raw_data} currency={currency} />

      {/* Expanded: Claude explanation */}
      {expanded && (
        <div className="pt-1 space-y-2 border-t border-white/60 mt-1">
          <div className="rounded-lg bg-white/70 px-3 py-2.5 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">AI explanation</p>
            <p className="text-xs text-slate-700 leading-relaxed">{anomaly.description}</p>
          </div>
          <div className="rounded-lg bg-white/70 px-3 py-2 flex items-start gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-500 mt-0.5 shrink-0">Action</span>
            <p className="text-xs text-slate-700">{anomaly.suggested_action}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

interface Props {
  anomalies:     AnomalyRecord[];
  criticalCount: number;
  warningCount:  number;
  currency:      string;
  unavailable:   boolean;
}

const TYPE_FILTER_OPTIONS = [
  { key: "",                label: "All types"    },
  { key: "sales_spike",    label: "Sales spikes" },
  { key: "sales_drop",     label: "Sales drops"  },
  { key: "stock_shrinkage", label: "Shrinkage"   },
  { key: "expense_outlier", label: "Expenses"    },
] as const;

export function AnomaliesClient({
  anomalies, criticalCount, warningCount, currency, unavailable,
}: Props) {
  const router = useRouter();
  const [sevFilter,  setSevFilter]  = useState<"" | "critical" | "warning">("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  const filtered = anomalies.filter((a) => {
    if (sevFilter  && a.severity !== sevFilter)  return false;
    if (typeFilter && a.type     !== typeFilter)  return false;
    return true;
  });

  // ── Offline ────────────────────────────────────────────────────────────────
  if (unavailable) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
        <Wifi className="h-10 w-10 text-slate-300" />
        <h3 className="font-semibold text-slate-600">AI service is offline</h3>
        <p className="text-sm text-slate-400 max-w-sm">
          Anomaly detection requires the AI service.
          Start it with <code className="bg-slate-100 px-1 rounded text-xs">uvicorn main:app --port 8000</code> inside <code className="bg-slate-100 px-1 rounded text-xs">ai/</code>.
        </p>
        <Button variant="outline" size="sm" className="gap-1.5 mt-2" onClick={() => router.refresh()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          Anomaly Alerts
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {anomalies.length === 0
            ? "No anomalies detected right now"
            : <>
                {anomalies.length} anomal{anomalies.length !== 1 ? "ies" : "y"} detected
                {criticalCount > 0 && <> · <span className="text-red-600 font-medium">{criticalCount} critical</span></>}
                {warningCount  > 0 && <> · {warningCount} warning</>}
              </>}
          {" · "}
          <span className="text-[11px] text-blue-500">Claude-explained · refreshes on each visit</span>
        </p>
      </div>

      {/* Stat summary */}
      {anomalies.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {criticalCount > 0 && (
            <button
              onClick={() => setSevFilter(sevFilter === "critical" ? "" : "critical")}
              className={cn(
                "rounded-xl border px-4 py-3 text-left transition-all",
                sevFilter === "critical"
                  ? "border-red-400 bg-red-100"
                  : "border-red-200 bg-red-50 hover:border-red-300"
              )}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-xs font-semibold text-red-700">Critical</span>
              </div>
              <p className="text-2xl font-bold text-red-700 tabular-nums">{criticalCount}</p>
            </button>
          )}
          {warningCount > 0 && (
            <button
              onClick={() => setSevFilter(sevFilter === "warning" ? "" : "warning")}
              className={cn(
                "rounded-xl border px-4 py-3 text-left transition-all",
                sevFilter === "warning"
                  ? "border-amber-400 bg-amber-100"
                  : "border-amber-200 bg-amber-50 hover:border-amber-300"
              )}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-semibold text-amber-700">Warning</span>
              </div>
              <p className="text-2xl font-bold text-amber-700 tabular-nums">{warningCount}</p>
            </button>
          )}
          {[...new Set(anomalies.map((a) => a.type))].map((type) => {
            const cfg = TYPE_CFG[type as keyof typeof TYPE_CFG];
            const count = anomalies.filter((a) => a.type === type).length;
            if (!cfg) return null;
            const Icon = cfg.icon;
            return (
              <button
                key={type}
                onClick={() => setTypeFilter(typeFilter === type ? "" : type)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left transition-all",
                  typeFilter === type
                    ? "border-slate-400 bg-slate-100"
                    : "border-slate-200 bg-white hover:border-slate-300"
                )}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <Icon className={cn("h-4 w-4", cfg.colour)} />
                  <span className="text-xs font-semibold text-slate-600">{cfg.label}</span>
                </div>
                <p className="text-2xl font-bold text-slate-700 tabular-nums">{count}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Filters */}
      {anomalies.length > 0 && (sevFilter || typeFilter) && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">Filtering: </span>
          {sevFilter && (
            <Badge variant="outline" className="text-xs cursor-pointer" onClick={() => setSevFilter("")}>
              {sevFilter} ×
            </Badge>
          )}
          {typeFilter && (
            <Badge variant="outline" className="text-xs cursor-pointer" onClick={() => setTypeFilter("")}>
              {TYPE_CFG[typeFilter as keyof typeof TYPE_CFG]?.label ?? typeFilter} ×
            </Badge>
          )}
          <button className="text-[11px] text-slate-400 hover:text-slate-600 ml-1" onClick={() => { setSevFilter(""); setTypeFilter(""); }}>
            Clear all
          </button>
          <span className="ml-auto text-[11px] text-slate-400">{filtered.length} shown</span>
        </div>
      )}

      {/* Anomaly cards */}
      {anomalies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
          <ShieldAlert className="h-10 w-10 text-green-300" />
          <h3 className="font-semibold text-slate-600">All clear</h3>
          <p className="text-sm text-slate-400 max-w-sm">
            No unusual sales patterns, stock shrinkage, or expense spikes detected.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-10">No anomalies match this filter.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((a, i) => (
            <AnomalyCard
              key={`${a.type}-${a.entity_id}-${i}`}
              anomaly={a}
              currency={currency}
            />
          ))}
        </div>
      )}

      <p className="text-[10px] text-slate-400">
        Sales: items selling 3× or &lt;0.3× their 30-day baseline rate · Shrinkage: manual stock
        adjustments with no sale/transfer record · Expenses: category spend ≥ 2× the 30-day average.
      </p>
    </div>
  );
}

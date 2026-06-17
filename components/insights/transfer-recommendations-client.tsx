"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Route, Wifi, RefreshCw, ArrowRight, Zap, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { ConfirmTransferDialog } from "@/components/insights/confirm-transfer-dialog";
import type { TransferRecommendation } from "@/app/(dashboard)/insights/transfer-recommendations/page";

// ── Priority config ────────────────────────────────────────────────────────

const PRI = {
  critical: {
    label: "Critical",
    badge: "bg-red-100 text-red-700 border-red-300",
    card:  "border-red-200 bg-red-50/30",
    dest:  "bg-red-50 border-red-200 text-red-800",
  },
  high: {
    label: "High",
    badge: "bg-amber-100 text-amber-700 border-amber-300",
    card:  "border-amber-200 bg-amber-50/20",
    dest:  "bg-amber-50 border-amber-200 text-amber-800",
  },
  medium: {
    label: "Medium",
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    card:  "border-slate-200 bg-white",
    dest:  "bg-blue-50 border-blue-100 text-blue-800",
  },
} as const;

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  recommendations: TransferRecommendation[];
  currency: string;
  criticalCount: number;
  highCount: number;
  totalCapitalFreed: number;
  totalReorderSavings: number;
  unavailable: boolean;
}

// ── Main component ─────────────────────────────────────────────────────────

export function TransferRecommendationsClient({
  recommendations,
  currency,
  criticalCount,
  highCount,
  totalCapitalFreed,
  totalReorderSavings,
  unavailable,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<TransferRecommendation | null>(null);
  const [priFilter, setPriFilter] = useState<"all" | "critical" | "high" | "medium">("all");

  const filtered = priFilter === "all"
    ? recommendations
    : recommendations.filter((r) => r.priority === priFilter);

  function handleSuccess() {
    setSelected(null);
    router.refresh();
  }

  // ── Offline ──────────────────────────────────────────────────────────────
  if (unavailable) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
        <Wifi className="h-10 w-10 text-slate-300" />
        <h3 className="font-semibold text-slate-600">AI service is offline</h3>
        <p className="text-sm text-slate-400 max-w-sm">
          Transfer recommendations need demand forecasts from the AI service.
          Start it with <code className="bg-slate-100 px-1 rounded text-xs">python -m uvicorn main:app --port 8000</code> inside the <code className="bg-slate-100 px-1 rounded text-xs">ai/</code> directory.
        </p>
        <Button variant="outline" size="sm" className="gap-1.5 mt-2" onClick={() => router.refresh()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  // ── No recommendations ───────────────────────────────────────────────────
  if (recommendations.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader count={0} currency={currency} criticalCount={0} highCount={0} totalCapital={0} totalSavings={0} />
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-2">
          <Route className="h-10 w-10 text-green-300" />
          <h3 className="font-semibold text-slate-600">No transfers needed</h3>
          <p className="text-sm text-slate-400">
            No branch has excess stock that another branch urgently needs.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        count={recommendations.length}
        currency={currency}
        criticalCount={criticalCount}
        highCount={highCount}
        totalCapital={totalCapitalFreed}
        totalSavings={totalReorderSavings}
      />

      {/* Summary stat + filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3 flex-wrap">
          {criticalCount > 0 && (
            <button
              onClick={() => setPriFilter(priFilter === "critical" ? "all" : "critical")}
              className={cn(
                "rounded-lg border px-3 py-2 text-center min-w-[100px] transition-all",
                priFilter === "critical"
                  ? "border-red-400 bg-red-100 text-red-700"
                  : "border-red-200 bg-red-50 text-red-700 hover:border-red-300"
              )}
            >
              <p className="text-xl font-bold tabular-nums">{criticalCount}</p>
              <p className="text-[10px] mt-0.5">Critical</p>
            </button>
          )}
          {highCount > 0 && (
            <button
              onClick={() => setPriFilter(priFilter === "high" ? "all" : "high")}
              className={cn(
                "rounded-lg border px-3 py-2 text-center min-w-[100px] transition-all",
                priFilter === "high"
                  ? "border-amber-400 bg-amber-100 text-amber-700"
                  : "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300"
              )}
            >
              <p className="text-xl font-bold tabular-nums">{highCount}</p>
              <p className="text-[10px] mt-0.5">High priority</p>
            </button>
          )}
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center min-w-[100px]">
            <p className="text-lg font-bold tabular-nums text-amber-700">{formatCurrency(totalCapitalFreed, currency)}</p>
            <p className="text-[10px] mt-0.5 text-amber-600">capital to free</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-center min-w-[100px]">
            <p className="text-lg font-bold tabular-nums text-green-700">~{formatCurrency(totalReorderSavings, currency)}</p>
            <p className="text-[10px] mt-0.5 text-green-600">reorders saved</p>
          </div>
        </div>

        {priFilter !== "all" && (
          <Button variant="ghost" size="sm" className="text-slate-500" onClick={() => setPriFilter("all")}>
            Clear filter
          </Button>
        )}
      </div>

      {/* Recommendation cards */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">No recommendations for this filter.</p>
        ) : (
          filtered.map((rec, i) => {
            const cfg = PRI[rec.priority];
            return (
              <div
                key={`${rec.item_id}-${rec.from_branch_id}-${rec.to_branch_id}-${i}`}
                className={cn("rounded-xl border p-4 space-y-3 transition-shadow hover:shadow-sm", cfg.card)}
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Badge className={cn("text-[10px] font-semibold border px-1.5 py-0 mt-0.5 shrink-0", cfg.badge)}>
                      {cfg.label}
                    </Badge>
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        Transfer {rec.transfer_qty} units of {rec.item_name}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400">{rec.sku}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 h-8 text-xs gap-1.5"
                    onClick={() => setSelected(rec)}
                  >
                    Transfer
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </div>

                {/* Branch route */}
                <div className="flex items-center gap-2 text-xs">
                  <div className="flex-1 rounded-lg bg-white border border-slate-200 px-3 py-2">
                    <p className="text-[9px] uppercase tracking-wide text-slate-400 mb-0.5">From</p>
                    <p className="font-semibold text-slate-800">{rec.from_branch_name}</p>
                    <p className="text-slate-500">
                      {rec.from_stock} units · <span className="text-slate-600">{rec.from_days_of_cover}d cover</span>
                    </p>
                  </div>

                  <div className="flex flex-col items-center gap-0.5 shrink-0 text-slate-400">
                    <ArrowRight className="h-4 w-4" />
                    <span className="text-[10px] font-semibold tabular-nums text-slate-600">
                      {rec.transfer_qty}u
                    </span>
                  </div>

                  <div className={cn("flex-1 rounded-lg border px-3 py-2", cfg.dest)}>
                    <p className="text-[9px] uppercase tracking-wide opacity-60 mb-0.5">To</p>
                    <p className="font-semibold">{rec.to_branch_name}</p>
                    <p className="opacity-75">
                      {rec.to_stock} units ·{" "}
                      {rec.to_days_of_cover !== null
                        ? <><span className="font-semibold">{rec.to_days_of_cover}d cover</span></>
                        : <span className="font-semibold">below ROP ({rec.to_rop})</span>}
                    </p>
                  </div>
                </div>

                {/* Benefits */}
                <div className="flex gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-medium px-2.5 py-0.5 border border-amber-200">
                    <Coins className="h-3 w-3" />
                    Frees {formatCurrency(rec.capital_freed, currency)} slow stock
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 text-[11px] font-medium px-2.5 py-0.5 border border-green-200">
                    <Zap className="h-3 w-3" />
                    Saves ~{formatCurrency(rec.reorder_savings, currency)} emergency reorder
                  </span>
                  {rec.confidence_score < 0.65 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-500 text-[11px] px-2.5 py-0.5 border border-slate-200">
                      Low confidence ({Math.round(rec.confidence_score * 100)}%) — verify demand
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="text-[11px] text-slate-400">
        {filtered.length} of {recommendations.length} transfer{recommendations.length !== 1 ? "s" : ""} shown
        · Source threshold: 30d cover · Demand from AI forecasts
      </p>

      <ConfirmTransferDialog
        rec={selected}
        currency={currency}
        onClose={() => setSelected(null)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

// ── Page header ────────────────────────────────────────────────────────────

function PageHeader({
  count, currency, criticalCount, highCount, totalCapital, totalSavings,
}: {
  count: number; currency: string; criticalCount: number;
  highCount: number; totalCapital: number; totalSavings: number;
}) {
  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <Route className="h-5 w-5 text-blue-500" />
        Transfer Hints
      </h1>
      <p className="text-sm text-slate-500 mt-0.5">
        {count === 0
          ? "No cross-branch transfer opportunities right now"
          : <>
              {count} transfer{count !== 1 ? "s" : ""} recommended
              {criticalCount > 0 && <> · <span className="text-red-600 font-medium">{criticalCount} critical</span></>}
              {highCount > 0 && <> · {highCount} high</>}
              {totalCapital > 0 && (
                <> · frees <span className="font-semibold text-amber-700">{formatCurrency(totalCapital, currency)}</span> + saves <span className="font-semibold text-green-700">~{formatCurrency(totalSavings, currency)}</span></>
              )}
            </>}
        {" · "}
        <span className="text-[11px] text-blue-500">AI-powered · demand from forecasts</span>
      </p>
    </div>
  );
}

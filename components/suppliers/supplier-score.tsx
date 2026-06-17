"use client";

import { cn } from "@/lib/utils";

// ── Shared type ────────────────────────────────────────────────────────────

export type SupplierScore = {
  supplier_id: string;
  supplier_name: string;
  overall_score: number;
  delivery_reliability: number;
  pricing_consistency: number;
  order_fill_rate: number;
  risk_level: "low" | "medium" | "high";
  recommendation: string;
  metrics: {
    order_count: number;
    avg_lead_days: number | null;
    max_lead_days: number | null;
    price_variance_pct: number;
    fill_rate_pct: number;
    total_spend: number;
  };
};

// ── Risk config ────────────────────────────────────────────────────────────

const RISK = {
  low:    { label: "Low risk",    bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200", bar: "bg-green-500"  },
  medium: { label: "Medium risk", bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200", bar: "bg-amber-500"  },
  high:   { label: "High risk",   bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200",   bar: "bg-red-500"    },
} as const;

function scoreColor(score: number) {
  if (score >= 75) return "text-green-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

function barColor(score: number) {
  if (score >= 75) return "bg-green-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

// ── Compact badge for supplier list ────────────────────────────────────────

export function SupplierScoreBadge({ score }: { score: SupplierScore | undefined }) {
  if (!score) {
    return <span className="text-slate-300 text-xs">—</span>;
  }
  const r = RISK[score.risk_level];
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className={cn("text-sm font-bold tabular-nums", scoreColor(score.overall_score))}>
        {Math.round(score.overall_score)}
      </span>
      <span className={cn("text-[9px] font-semibold px-1.5 py-0 rounded border", r.bg, r.text, r.border)}>
        {r.label}
      </span>
    </div>
  );
}

// ── Sub-score row ──────────────────────────────────────────────────────────

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline">
        <span className="text-[11px] text-slate-500">{label}</span>
        <span className={cn("text-[11px] font-semibold tabular-nums", scoreColor(pct))}>
          {Math.round(pct)}/100
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", barColor(pct))}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Full card for supplier detail page ────────────────────────────────────

export function SupplierScoreCard({ score }: { score: SupplierScore | undefined | null }) {
  if (!score) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 flex items-center gap-3">
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
          <span className="text-slate-300 text-lg font-bold">?</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700">AI Reliability Score</p>
          <p className="text-xs text-slate-400 mt-0.5">
            No purchase orders yet. Score will appear after your first order with this supplier.
          </p>
        </div>
      </div>
    );
  }

  const r = RISK[score.risk_level];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            AI Reliability Score
          </p>
          <p className={cn("text-4xl font-bold tabular-nums mt-1", scoreColor(score.overall_score))}>
            {Math.round(score.overall_score)}
            <span className="text-base font-normal text-slate-300">/100</span>
          </p>
        </div>
        <span className={cn(
          "text-xs font-semibold px-2.5 py-1 rounded-full border mt-1",
          r.bg, r.text, r.border
        )}>
          {r.label}
        </span>
      </div>

      {/* Sub-score bars */}
      <div className="space-y-2.5">
        <ScoreBar label="Delivery reliability"   value={score.delivery_reliability} />
        <ScoreBar label="Pricing consistency"    value={score.pricing_consistency} />
        <ScoreBar label="Order fill rate"        value={score.order_fill_rate} />
      </div>

      {/* Metrics strip */}
      <div className="grid grid-cols-3 gap-2 pt-0.5">
        <div className="text-center">
          <p className="text-xs font-semibold text-slate-700 tabular-nums">{score.metrics.order_count}</p>
          <p className="text-[9px] text-slate-400">POs analysed</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold text-slate-700 tabular-nums">
            {score.metrics.avg_lead_days !== null ? `${score.metrics.avg_lead_days}d` : "—"}
          </p>
          <p className="text-[9px] text-slate-400">avg lead time</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold text-slate-700 tabular-nums">
            {score.metrics.price_variance_pct.toFixed(1)}%
          </p>
          <p className="text-[9px] text-slate-400">price variance</p>
        </div>
      </div>

      {/* Claude narrative */}
      {score.recommendation && (
        <div className={cn(
          "rounded-lg border px-3 py-2.5 text-xs leading-relaxed",
          r.bg, r.border, r.text
        )}>
          <span className="font-semibold">AI: </span>
          {score.recommendation}
        </div>
      )}
    </div>
  );
}

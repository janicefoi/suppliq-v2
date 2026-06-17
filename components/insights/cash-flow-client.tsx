"use client";

import { useRouter } from "next/navigation";
import {
  Banknote, Wifi, RefreshCw, TrendingUp, TrendingDown,
  ShoppingCart, Receipt, Info,
} from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatCurrencyCompact } from "@/lib/utils";
import type { DailyPoint, PurchaseItem, ExpenseCategory } from "@/app/(dashboard)/insights/cash-flow/page";

// ── Custom chart tooltip ────────────────────────────────────────────────────

function ChartTip({
  active, payload, label, currency,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-md px-3 py-2 text-xs space-y-1 min-w-[160px]">
      <p className="font-semibold text-slate-700 border-b border-slate-100 pb-1 mb-1">
        Day {label}
      </p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }} className="font-medium">{p.name}</span>
          <span className="tabular-nums text-slate-700">{formatCurrency(p.value, currency)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────

function StatCard({
  label, value, currency, icon: Icon, positive, neutral, sub,
}: {
  label: string;
  value: number;
  currency: string;
  icon: React.ComponentType<{ className?: string }>;
  positive?: boolean;
  neutral?: boolean;
  sub?: string;
}) {
  const isPositive = positive ?? value >= 0;
  const colour = neutral
    ? "text-slate-700"
    : isPositive ? "text-green-700" : "text-red-700";
  const bg = neutral
    ? "border-slate-200 bg-white"
    : isPositive ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50";

  return (
    <div className={cn("rounded-xl border p-4", bg)}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn("h-4 w-4", neutral ? "text-slate-500" : isPositive ? "text-green-500" : "text-red-500")} />
        <span className="text-xs font-semibold text-slate-500">{label}</span>
      </div>
      <p className={cn("text-2xl font-bold tabular-nums", colour)}>
        {formatCurrency(value, currency)}
      </p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  currency: string;
  projectedRevenue: number;
  projectedExpenses: number;
  projectedPurchases: number;
  netCash: number;
  revenueMethod: "forecast" | "rolling_avg";
  forecastConfidence: number;
  commentary: string;
  expenseBreakdown: ExpenseCategory[];
  purchaseBreakdown: PurchaseItem[];
  dailyTimeline: DailyPoint[];
  recentRevenueDays: number;
  unavailable: boolean;
}

// ── Category label formatter ───────────────────────────────────────────────

function fmtCat(cat: string) {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Main component ──────────────────────────────────────────────────────────

export function CashFlowClient({
  currency, projectedRevenue, projectedExpenses, projectedPurchases, netCash,
  revenueMethod, forecastConfidence, commentary, expenseBreakdown,
  purchaseBreakdown, dailyTimeline, recentRevenueDays, unavailable,
}: Props) {
  const router = useRouter();

  // ── Offline ───────────────────────────────────────────────────────────────
  if (unavailable) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
        <Wifi className="h-10 w-10 text-slate-300" />
        <h3 className="font-semibold text-slate-600">AI service is offline</h3>
        <p className="text-sm text-slate-400 max-w-sm">
          Cash flow projection needs demand forecasts from the AI service.
          Start it with <code className="bg-slate-100 px-1 rounded text-xs">uvicorn main:app --port 8000</code> inside <code className="bg-slate-100 px-1 rounded text-xs">ai/</code>.
        </p>
        <Button variant="outline" size="sm" className="gap-1.5 mt-2" onClick={() => router.refresh()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  const totalOutflows = projectedExpenses + projectedPurchases;
  const netIsPositive = netCash >= 0;

  // X-axis tick formatter: show every 5th day
  const xTick = (day: number) => day % 5 === 0 || day === 1 ? `D${day}` : "";

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Banknote className="h-5 w-5 text-blue-500" />
          30-Day Cash Flow Projection
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Revenue from{" "}
          {revenueMethod === "forecast"
            ? <>AI demand forecasts {forecastConfidence > 0 && <span className="text-blue-500">({Math.round(forecastConfidence * 100)}% avg confidence)</span>}</>
            : <span className="text-amber-600">30-day rolling average (no forecasts yet — run the nightly job)</span>}
          {" · "}expenses from last 30-day run rate{" · "}purchases estimated from items below ROP
        </p>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Projected Revenue"
          value={projectedRevenue}
          currency={currency}
          icon={TrendingUp}
          positive
          neutral={false}
          sub={`${recentRevenueDays}d of sales history`}
        />
        <StatCard
          label="Recurring Expenses"
          value={projectedExpenses}
          currency={currency}
          icon={Receipt}
          positive={false}
          neutral
          sub={`${expenseBreakdown.length} categor${expenseBreakdown.length !== 1 ? "ies" : "y"}`}
        />
        <StatCard
          label="Purchase Commitments"
          value={projectedPurchases}
          currency={currency}
          icon={ShoppingCart}
          positive={false}
          neutral
          sub={purchaseBreakdown.length > 0 ? `${purchaseBreakdown.length} item${purchaseBreakdown.length !== 1 ? "s" : ""} below ROP` : "No items below ROP"}
        />
        <StatCard
          label="Net Position"
          value={netCash}
          currency={currency}
          icon={netIsPositive ? TrendingUp : TrendingDown}
          positive={netIsPositive}
          neutral={false}
          sub={netIsPositive ? "cash surplus expected" : "cash shortfall expected"}
        />
      </div>

      {/* ── Claude commentary ───────────────────────────────────────────── */}
      {commentary && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3.5">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-blue-100 border border-blue-200 p-1.5 shrink-0 mt-0.5">
              <Banknote className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-500 mb-1">
                CFO commentary · AI-generated
              </p>
              <p className="text-sm text-blue-900 leading-relaxed">{commentary}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Daily chart ─────────────────────────────────────────────────── */}
      {dailyTimeline.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Daily cash flow — next 30 days
          </p>
          <div className="rounded-xl border border-slate-200 bg-white p-3 pt-4">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={dailyTimeline} margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="day"
                  tickFormatter={xTick}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  tickFormatter={(v) => formatCurrencyCompact(v, currency)}
                  axisLine={false}
                  tickLine={false}
                  width={70}
                />
                <RechartsTooltip
                  content={(props) => (
                    <ChartTip {...props as any} currency={currency} />
                  )}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                {/* Outflows (expenses + purchases) — rendered behind */}
                <Bar dataKey="expenses" name="Expenses" fill="#fca5a5" radius={[2, 2, 0, 0]} maxBarSize={16} />
                <Bar dataKey="purchases" name="Purchases" fill="#fcd34d" radius={[2, 2, 0, 0]} maxBarSize={16} />
                {/* Revenue bar */}
                <Bar dataKey="revenue" name="Revenue" fill="#86efac" radius={[2, 2, 0, 0]} maxBarSize={16} />
                {/* Net cumulative line */}
                <Line
                  dataKey="cumulative"
                  name="Net position"
                  type="monotone"
                  stroke={netIsPositive ? "#2563eb" : "#dc2626"}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="4 2" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 text-center">
            Revenue and outflows shown as daily bars · Net position (blue line) = cumulative running total
            · Purchase commitments front-loaded days 1-7
          </p>
        </div>
      )}

      {/* ── Breakdown grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Expense breakdown */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Expense run rate by category
          </p>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            {expenseBreakdown.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No expense data for the last 30 days.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500">Category</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500">30-day total</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenseBreakdown.map((e) => {
                    const pct = projectedExpenses > 0
                      ? Math.round((e.total / projectedExpenses) * 100)
                      : 0;
                    return (
                      <tr key={e.category} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-700 font-medium">{fmtCat(e.category)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                          {formatCurrency(e.total, currency)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-red-300 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-slate-400 tabular-nums w-8 text-right">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50 border-t border-slate-200">
                    <td className="px-3 py-2 text-xs font-semibold text-slate-600">Total</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-700">
                      {formatCurrency(projectedExpenses, currency)}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Purchase commitments */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Estimated reorder spend (items below ROP)
          </p>
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            {purchaseBreakdown.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center gap-1">
                <TrendingUp className="h-6 w-6 text-green-300" />
                <p className="text-sm text-slate-400">No items below reorder point.</p>
                <p className="text-[11px] text-slate-300">No purchase commitments expected.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500">Item</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500">Qty</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500">Est. cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchaseBreakdown.map((p) => (
                    <tr key={`${p.item_id}-${p.branch_name}`} className="hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-800 text-xs leading-tight truncate max-w-[140px]">
                          {p.item_name}
                        </p>
                        <p className="text-[10px] font-mono text-slate-400">
                          {p.sku}
                          {p.branch_name && <span className="ml-1 text-slate-300">· {p.branch_name}</span>}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {p.stock_qty} in stock · ROP {p.reorder_point}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="text-xs tabular-nums text-amber-700 font-semibold">
                          {p.est_order_qty}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="text-xs tabular-nums font-semibold text-slate-700">
                          {formatCurrency(p.est_total_cost, currency)}
                        </span>
                        <p className="text-[10px] text-slate-400 tabular-nums">
                          @{formatCurrency(p.unit_cost, currency)}
                        </p>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 border-t border-slate-200">
                    <td className="px-3 py-2 text-xs font-semibold text-slate-600" colSpan={2}>
                      Total commitment
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-semibold text-amber-700 tabular-nums">
                      {formatCurrency(projectedPurchases, currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 text-[10px] text-slate-400 pt-1">
        <Info className="h-3 w-3 shrink-0 mt-0.5" />
        <span>
          Revenue projected from {revenueMethod === "forecast" ? "AI demand forecasts × retail price" : "30-day rolling average (run the nightly job for forecast-based projection)"}.
          Expenses from last 30-day actuals. Purchase estimates assume restocking to 2×ROP at wholesale price.
          Figures are projections, not guarantees.
        </span>
      </div>
    </div>
  );
}

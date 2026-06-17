"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Layers, Wifi, RefreshCw, ChevronUp, ChevronDown, Minus } from "lucide-react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import type { AbcXyzItem, AbcXyzMatrix, ClassCounts } from "@/app/(dashboard)/insights/abc/page";

// ── Colour / label constants ────────────────────────────────────────────────

const CLASS_COLOUR: Record<string, string> = {
  AX: "#22c55e", AY: "#10b981", AZ: "#f59e0b",
  BX: "#38bdf8", BY: "#64748b", BZ: "#f97316",
  CX: "#a3e635", CY: "#facc15", CZ: "#ef4444",
};

// lightened bg versions for the matrix cells
const CLASS_BG: Record<string, string> = {
  AX: "bg-green-100 border-green-300",
  AY: "bg-emerald-100 border-emerald-300",
  AZ: "bg-amber-100 border-amber-300",
  BX: "bg-sky-100 border-sky-300",
  BY: "bg-slate-100 border-slate-300",
  BZ: "bg-orange-100 border-orange-300",
  CX: "bg-lime-100 border-lime-300",
  CY: "bg-yellow-100 border-yellow-300",
  CZ: "bg-red-100 border-red-300",
};

const CLASS_TEXT: Record<string, string> = {
  AX: "text-green-800", AY: "text-emerald-800", AZ: "text-amber-800",
  BX: "text-sky-800",   BY: "text-slate-700",   BZ: "text-orange-800",
  CX: "text-lime-800",  CY: "text-yellow-800",  CZ: "text-red-800",
};

const ABC_BADGE: Record<string, string> = {
  A: "bg-green-100 text-green-800 border-green-300",
  B: "bg-sky-100 text-sky-800 border-sky-300",
  C: "bg-red-100 text-red-700 border-red-300",
};

const XYZ_BADGE: Record<string, string> = {
  X: "bg-emerald-100 text-emerald-800 border-emerald-300",
  Y: "bg-amber-100 text-amber-700 border-amber-300",
  Z: "bg-red-100 text-red-700 border-red-300",
};

const MATRIX_ORDER = [
  ["AX", "BX", "CX"],
  ["AY", "BY", "CY"],
  ["AZ", "BZ", "CZ"],
];

// ── Props ───────────────────────────────────────────────────────────────────

interface Props {
  items: AbcXyzItem[];
  matrix: AbcXyzMatrix;
  classCounts: ClassCounts;
  totalRevenue: number;
  itemCount: number;
  currency: string;
  periodDays: number;
  unavailable: boolean;
}

// ── Custom scatter tooltip ──────────────────────────────────────────────────

function ScatterTip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-md px-3 py-2 text-xs space-y-0.5 max-w-[220px]">
      <p className="font-semibold text-slate-800 truncate">{d.item_name}</p>
      <p className="font-mono text-slate-400 text-[10px]">{d.sku}</p>
      <div className="flex gap-1.5 mt-1">
        <span className={cn("rounded px-1.5 py-0.5 border font-semibold", ABC_BADGE[d.abc])}>
          {d.abc}
        </span>
        <span className={cn("rounded px-1.5 py-0.5 border font-semibold", XYZ_BADGE[d.xyz])}>
          {d.xyz}
        </span>
      </div>
      <p className="text-slate-600 tabular-nums">Revenue: <span className="font-semibold">{d.revenueLabel}</span></p>
      <p className="text-slate-600">Cumulative: {d.x.toFixed(1)}%</p>
      <p className="text-slate-600">CV: {d.week_count < 3 ? "n/a (<3 wks)" : d.y.toFixed(3)}</p>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function AbcAnalysisClient({
  items,
  matrix,
  classCounts,
  totalRevenue,
  itemCount,
  currency,
  periodDays,
  unavailable,
}: Props) {
  const router = useRouter();
  const [abcFilter, setAbcFilter] = useState<"" | "A" | "B" | "C">("");
  const [xyzFilter, setXyzFilter] = useState<"" | "X" | "Y" | "Z">("");
  const [showAll, setShowAll]     = useState(false);
  const [sortKey, setSortKey]     = useState<"revenue" | "cv">("revenue");
  const [sortAsc, setSortAsc]     = useState(false);

  // ── Scatter data grouped by combined class ────────────────────────────────
  const scatterByClass = useMemo(() => {
    const groups: Record<string, object[]> = {};
    for (const item of items) {
      const cls = item.combined_class;
      if (!groups[cls]) groups[cls] = [];
      groups[cls].push({
        x:            item.cumulative_revenue_pct,
        y:            Math.min(item.cv, 3.5),
        item_name:    item.item_name,
        sku:          item.sku,
        abc:          item.abc_class,
        xyz:          item.xyz_class,
        week_count:   item.week_count,
        revenueLabel: formatCurrency(item.revenue, currency),
      });
    }
    return groups;
  }, [items, currency]);

  // ── Table filtered + sorted ───────────────────────────────────────────────
  const tableItems = useMemo(() => {
    let rows = items;
    if (abcFilter) rows = rows.filter((i) => i.abc_class === abcFilter);
    if (xyzFilter) rows = rows.filter((i) => i.xyz_class === xyzFilter);
    const dir = sortAsc ? 1 : -1;
    if (sortKey === "cv") {
      rows = [...rows].sort((a, b) => dir * (a.cv - b.cv));
    } else {
      rows = [...rows].sort((a, b) => dir * (a.revenue - b.revenue));
    }
    return rows;
  }, [items, abcFilter, xyzFilter, sortKey, sortAsc]);

  const visibleRows = showAll ? tableItems : tableItems.slice(0, 50);

  function toggleSort(key: "revenue" | "cv") {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  }

  function SortIcon({ col }: { col: "revenue" | "cv" }) {
    if (sortKey !== col) return <Minus className="h-3 w-3 text-slate-300 inline ml-0.5" />;
    return sortAsc
      ? <ChevronUp className="h-3 w-3 text-slate-500 inline ml-0.5" />
      : <ChevronDown className="h-3 w-3 text-slate-500 inline ml-0.5" />;
  }

  // ── Offline ───────────────────────────────────────────────────────────────
  if (unavailable) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
        <Wifi className="h-10 w-10 text-slate-300" />
        <h3 className="font-semibold text-slate-600">AI service is offline</h3>
        <p className="text-sm text-slate-400 max-w-sm">
          ABC/XYZ analysis requires the AI service for demand variability data.
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

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Layers className="h-5 w-5 text-blue-500" />
          ABC / XYZ Analysis
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {itemCount} active items · {periodDays}-day window ·{" "}
          <span className="font-medium text-green-700">A: {classCounts.A}</span>{" "}
          <span className="text-slate-300">·</span>{" "}
          <span className="font-medium text-sky-700">B: {classCounts.B}</span>{" "}
          <span className="text-slate-300">·</span>{" "}
          <span className="font-medium text-red-700">C: {classCounts.C}</span>{" "}
          <span className="text-slate-300 mx-1">|</span>
          X: {classCounts.X} · Y: {classCounts.Y} · Z: {classCounts.Z}{" "}
          · Total revenue{" "}
          <span className="font-semibold text-slate-700">{formatCurrency(totalRevenue, currency)}</span>
        </p>
      </div>

      {/* ── Matrix + Scatter ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* 3×3 Matrix */}
        <div className="lg:col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Class matrix
          </p>
          {/* Column headers */}
          <div className="grid grid-cols-3 gap-px mb-0.5">
            {["A — High", "B — Mid", "C — Low"].map((h, i) => (
              <div key={i} className="text-center text-[10px] font-semibold text-slate-500 pb-0.5">
                {h}
              </div>
            ))}
          </div>
          {/* Rows */}
          {MATRIX_ORDER.map((row, ri) => (
            <div key={ri} className="grid grid-cols-3 gap-px mb-px">
              {row.map((cls) => {
                const cell = matrix[cls] ?? { count: 0, revenue: 0 };
                return (
                  <button
                    key={cls}
                    onClick={() => {
                      setAbcFilter(abcFilter === cls[0] as "A"|"B"|"C" ? "" : cls[0] as "A"|"B"|"C");
                      setXyzFilter(xyzFilter === cls[1] as "X"|"Y"|"Z" ? "" : cls[1] as "X"|"Y"|"Z");
                    }}
                    className={cn(
                      "rounded border p-2 text-center transition-all hover:brightness-95",
                      CLASS_BG[cls],
                      CLASS_TEXT[cls],
                    )}
                  >
                    <p className="text-xs font-bold">{cls}</p>
                    <p className="text-lg font-bold tabular-nums leading-tight">{cell.count}</p>
                    <p className="text-[9px] opacity-70 truncate">
                      {cell.count > 0 ? formatCurrency(cell.revenue, currency) : "—"}
                    </p>
                  </button>
                );
              })}
            </div>
          ))}
          {/* Row labels (overlaid via margin trick) */}
          <div className="flex gap-px mt-0.5">
            <div className="flex-1 text-[10px] font-semibold text-slate-500 text-center">X stable</div>
            <div className="flex-1 text-[10px] font-semibold text-slate-500 text-center">Y variable</div>
            <div className="flex-1 text-[10px] font-semibold text-slate-500 text-center">Z erratic</div>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 leading-snug">
            Tap a cell to filter the table below.
            AX = best stock; CZ = discontinue candidate.
          </p>
        </div>

        {/* Scatter chart */}
        <div className="lg:col-span-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Revenue vs. demand variability
          </p>
          <div className="rounded-xl border border-slate-200 bg-white p-2 pt-3">
            <ResponsiveContainer width="100%" height={290}>
              <ScatterChart margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Cumulative Revenue %"
                  domain={[0, 100]}
                  tickCount={6}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  label={{ value: "← A   B   C →   (cumulative revenue %)", position: "insideBottom", offset: -12, fontSize: 9, fill: "#94a3b8" }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="CV"
                  domain={[0, "auto"]}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  label={{ value: "CV (variability)", angle: -90, position: "insideLeft", fontSize: 9, fill: "#94a3b8", dx: 12 }}
                />
                <RechartsTooltip content={<ScatterTip />} />
                {/* A/B/C boundaries */}
                <ReferenceLine x={80} stroke="#e2e8f0" strokeDasharray="4 2" label={{ value: "80%", fontSize: 9, fill: "#94a3b8", position: "top" }} />
                <ReferenceLine x={95} stroke="#e2e8f0" strokeDasharray="4 2" label={{ value: "95%", fontSize: 9, fill: "#94a3b8", position: "top" }} />
                {/* X/Y/Z boundaries */}
                <ReferenceLine y={0.5} stroke="#e2e8f0" strokeDasharray="4 2" label={{ value: "CV 0.5", fontSize: 9, fill: "#94a3b8", position: "right" }} />
                <ReferenceLine y={1.0} stroke="#e2e8f0" strokeDasharray="4 2" label={{ value: "CV 1.0", fontSize: 9, fill: "#94a3b8", position: "right" }} />
                {Object.entries(CLASS_COLOUR).map(([cls, colour]) =>
                  scatterByClass[cls]?.length ? (
                    <Scatter
                      key={cls}
                      name={cls}
                      data={scatterByClass[cls] as any}
                      fill={colour}
                      fillOpacity={0.7}
                      r={4}
                    />
                  ) : null
                )}
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 text-center">
            Each dot is one SKU · X-axis: cumulative Pareto revenue · Y-axis: demand CV
          </p>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div>
        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Filter:</span>
          {(["A", "B", "C"] as const).map((cls) => (
            <button
              key={cls}
              onClick={() => setAbcFilter(abcFilter === cls ? "" : cls)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs border font-medium transition-all",
                abcFilter === cls
                  ? "border-transparent " + (cls === "A" ? "bg-green-600 text-white" : cls === "B" ? "bg-sky-600 text-white" : "bg-red-600 text-white")
                  : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white",
              )}
            >
              {cls} ({classCounts[cls]})
            </button>
          ))}
          <span className="text-slate-200">|</span>
          {(["X", "Y", "Z"] as const).map((cls) => (
            <button
              key={cls}
              onClick={() => setXyzFilter(xyzFilter === cls ? "" : cls)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs border font-medium transition-all",
                xyzFilter === cls
                  ? "border-transparent " + (cls === "X" ? "bg-emerald-600 text-white" : cls === "Y" ? "bg-amber-500 text-white" : "bg-red-600 text-white")
                  : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white",
              )}
            >
              {cls} ({classCounts[cls]})
            </button>
          ))}
          {(abcFilter || xyzFilter) && (
            <button
              onClick={() => { setAbcFilter(""); setXyzFilter(""); }}
              className="text-[11px] text-slate-400 hover:text-slate-600 ml-1"
            >
              Clear
            </button>
          )}
          <span className="ml-auto text-[11px] text-slate-400">
            {tableItems.length} item{tableItems.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 w-10">#</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500">Item</th>
                <th
                  className="px-3 py-2.5 text-right text-[11px] font-semibold text-slate-500 cursor-pointer hover:text-slate-700 whitespace-nowrap"
                  onClick={() => toggleSort("revenue")}
                >
                  Revenue <SortIcon col="revenue" />
                </th>
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-slate-500">ABC</th>
                <th
                  className="px-3 py-2.5 text-right text-[11px] font-semibold text-slate-500 cursor-pointer hover:text-slate-700"
                  onClick={() => toggleSort("cv")}
                >
                  CV <SortIcon col="cv" />
                </th>
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-slate-500">XYZ</th>
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-slate-500">Class</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-slate-500 hidden xl:table-cell">Stock</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500 hidden 2xl:table-cell">Recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map((item) => (
                <tr key={item.item_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2.5 text-slate-400 tabular-nums text-xs">{item.rank}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-slate-800 text-sm leading-tight">{item.item_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-[10px] text-slate-400">{item.sku}</span>
                      {item.category !== "Uncategorised" && (
                        <span className="text-[10px] text-slate-400">· {item.category}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <p className="font-semibold tabular-nums text-slate-800">{formatCurrency(item.revenue, currency)}</p>
                    <p className="text-[10px] text-slate-400 tabular-nums">{item.revenue_pct.toFixed(2)}% · cum {item.cumulative_revenue_pct.toFixed(1)}%</p>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={cn("inline-block rounded px-1.5 py-0.5 text-xs font-bold border", ABC_BADGE[item.abc_class])}>
                      {item.abc_class}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {item.week_count >= 3
                      ? <span className="tabular-nums text-slate-700 text-xs">{item.cv.toFixed(3)}</span>
                      : <span className="text-[10px] text-slate-400">n/a</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={cn("inline-block rounded px-1.5 py-0.5 text-xs font-bold border", XYZ_BADGE[item.xyz_class])}>
                      {item.xyz_class}
                    </span>
                    {item.xyz_class === "Z" && item.week_count < 3 && (
                      <span className="block text-[8px] text-slate-400 leading-tight">low data</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className="inline-block rounded px-2 py-0.5 text-xs font-black border"
                      style={{
                        backgroundColor: CLASS_COLOUR[item.combined_class] + "22",
                        borderColor:     CLASS_COLOUR[item.combined_class] + "66",
                        color:           CLASS_COLOUR[item.combined_class],
                      }}
                    >
                      {item.combined_class}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right hidden xl:table-cell">
                    <p className="text-xs tabular-nums text-slate-700">{item.stock_qty} units</p>
                    {item.stock_value > 0 && (
                      <p className="text-[10px] text-slate-400 tabular-nums">{formatCurrency(item.stock_value, currency)}</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 hidden 2xl:table-cell">
                    <p className="text-[11px] text-slate-500 leading-snug max-w-[220px]">{item.action}</p>
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-sm text-slate-400">
                    No items match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {tableItems.length > 50 && (
          <div className="mt-2 text-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-500 text-xs"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? `Show top 50` : `Show all ${tableItems.length} items`}
            </Button>
          </div>
        )}

        <p className="text-[10px] text-slate-400 mt-2">
          ABC: A = cumulative 80% revenue, B = 80-95%, C = remainder.
          XYZ: X = CV &lt; 0.5 (stable), Y = 0.5-1.0 (moderate), Z ≥ 1.0 (variable).
          Items with fewer than 3 weeks of sales data are classified Z.
        </p>
      </div>
    </div>
  );
}

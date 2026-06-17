"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingDown, Wifi, RefreshCw, Tag, ArrowRightLeft, ChevronDown, ChevronUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn, formatCurrency } from "@/lib/utils";
import { MarkdownDialog } from "@/components/insights/markdown-dialog";
import { OverstockTransferDialog } from "@/components/insights/overstock-transfer-dialog";
import type { OverstockItem } from "@/app/(dashboard)/insights/overstock/page";

// ── Severity config ────────────────────────────────────────────────────────

const SEV = {
  severe: { label: "Severe",  badge: "bg-red-100 text-red-700 border-red-300",     row: "bg-red-50/30"    },
  high:   { label: "High",    badge: "bg-amber-100 text-amber-700 border-amber-300", row: "bg-amber-50/20" },
  medium: { label: "Medium",  badge: "bg-yellow-50 text-yellow-700 border-yellow-200", row: ""              },
} as const;

// ── Stat card ──────────────────────────────────────────────────────────────

function StatCard({ value, label, colour }: { value: string | number; label: string; colour: string }) {
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-center min-w-[110px]", colour)}>
      <p className="text-xl font-bold tabular-nums leading-tight">{value}</p>
      <p className="text-[10px] mt-0.5 opacity-70">{label}</p>
    </div>
  );
}

// ── Days-of-cover colour ───────────────────────────────────────────────────

function daysColour(days: number) {
  if (days > 120) return "text-red-600 font-bold";
  if (days > 90)  return "text-amber-600 font-semibold";
  return "text-yellow-700";
}

// ── Turnover display ───────────────────────────────────────────────────────

function TurnoverCell({ rate }: { rate: number }) {
  const label = rate < 1 ? "<1 turn/yr" : `${rate.toFixed(1)}×/yr`;
  return (
    <span className={cn("text-xs tabular-nums", rate < 2 ? "text-red-500" : rate < 4 ? "text-amber-600" : "text-green-600")}>
      {label}
    </span>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  items: OverstockItem[];
  currency: string;
  totalCapitalTied: number;
  severeCount: number;
  highCount: number;
  unavailable: boolean;
  isAdmin: boolean;
}

// ── Main component ─────────────────────────────────────────────────────────

export function OverstockClient({
  items,
  currency,
  totalCapitalTied,
  severeCount,
  highCount,
  unavailable,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [sevFilter, setSevFilter] = useState<"all" | "severe" | "high" | "medium">("all");
  const [markdownTarget, setMarkdownTarget] = useState<OverstockItem | null>(null);
  const [transferTarget, setTransferTarget] = useState<OverstockItem | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const filtered = sevFilter === "all"
    ? items
    : items.filter((i) => i.severity === sevFilter);

  function toggleRow(key: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function handleSuccess() {
    setMarkdownTarget(null);
    setTransferTarget(null);
    router.refresh();
  }

  // ── AI offline ──────────────────────────────────────────────────────────
  if (unavailable) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
        <Wifi className="h-10 w-10 text-slate-300" />
        <h3 className="font-semibold text-slate-600">AI service is offline</h3>
        <p className="text-sm text-slate-400 max-w-sm">
          Overstock detection needs demand forecasts from the AI service.
          Start it with <code className="bg-slate-100 px-1 rounded text-xs">python -m uvicorn main:app --port 8000</code> inside the <code className="bg-slate-100 px-1 rounded text-xs">ai/</code> directory.
        </p>
        <Button variant="outline" size="sm" className="gap-1.5 mt-2" onClick={() => router.refresh()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  // ── No overstocked items ─────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader count={0} totalCapital={0} currency={currency} severeCount={0} highCount={0} />
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-2">
          <TrendingDown className="h-10 w-10 text-green-300" />
          <h3 className="font-semibold text-slate-600">No overstocked items</h3>
          <p className="text-sm text-slate-400">All items have less than 60 days of cover.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        count={items.length}
        totalCapital={totalCapitalTied}
        currency={currency}
        severeCount={severeCount}
        highCount={highCount}
      />

      {/* Stats + filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <StatCard
            value={severeCount}
            label=">120d cover"
            colour="border-red-200 bg-red-50 text-red-700"
          />
          <StatCard
            value={highCount}
            label="90-120d cover"
            colour="border-amber-200 bg-amber-50 text-amber-700"
          />
          <StatCard
            value={items.length - severeCount - highCount}
            label="60-90d cover"
            colour="border-yellow-200 bg-yellow-50 text-yellow-700"
          />
          <StatCard
            value={formatCurrency(totalCapitalTied, currency)}
            label="total tied up"
            colour="border-slate-200 bg-slate-50 text-slate-700"
          />
        </div>

        <select
          value={sevFilter}
          onChange={(e) => setSevFilter(e.target.value as typeof sevFilter)}
          className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="all">All severities</option>
          <option value="severe">Severe only (&gt;120d)</option>
          <option value="high">High only (90-120d)</option>
          <option value="medium">Medium only (60-90d)</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden [&_th]:h-8 [&_th]:py-2 [&_th]:text-[11px] [&_td]:py-2 [&_td]:align-middle">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="w-4" />
              <TableHead className="w-20">Severity</TableHead>
              <TableHead className="min-w-[170px]">Item</TableHead>
              <TableHead className="w-28">Branch</TableHead>
              <TableHead className="w-20 text-right">Stock</TableHead>
              <TableHead className="w-24 text-right">Days cover</TableHead>
              <TableHead className="w-24 text-right">Excess units</TableHead>
              <TableHead className="w-32 text-right">Capital tied</TableHead>
              <TableHead className="w-24 text-right">Turnover</TableHead>
              <TableHead className="w-44 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-xs text-slate-400">
                  No items match this filter.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => {
                const key = `${item.item_id}-${item.branch_id}`;
                const cfg = SEV[item.severity];
                const expanded = expandedRows.has(key);
                return (
                  <>
                    <TableRow
                      key={key}
                      className={cn("cursor-pointer hover:bg-blue-50/20 transition-colors", cfg.row)}
                      onClick={() => toggleRow(key)}
                    >
                      <TableCell className="pl-3 pr-0">
                        {expanded
                          ? <ChevronUp className="h-3 w-3 text-slate-400" />
                          : <ChevronDown className="h-3 w-3 text-slate-400" />}
                      </TableCell>

                      <TableCell>
                        <Badge className={cn("text-[10px] font-semibold border px-1.5 py-0", cfg.badge)}>
                          {cfg.label}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <p className="font-medium text-xs text-slate-800">{item.item_name}</p>
                        <p className="font-mono text-[10px] text-slate-400">{item.sku}</p>
                      </TableCell>

                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {item.branch_name}
                      </TableCell>

                      <TableCell className="text-right text-xs font-semibold text-slate-700 tabular-nums">
                        {item.current_stock}
                      </TableCell>

                      <TableCell className="text-right whitespace-nowrap">
                        <span className={cn("text-xs tabular-nums", daysColour(item.days_of_cover))}>
                          {item.days_of_cover}d
                        </span>
                      </TableCell>

                      <TableCell className="text-right text-xs tabular-nums text-slate-600">
                        +{item.excess_units}
                      </TableCell>

                      <TableCell className="text-right text-xs tabular-nums font-semibold text-slate-800">
                        {formatCurrency(item.capital_tied, currency)}
                      </TableCell>

                      <TableCell className="text-right">
                        <TurnoverCell rate={item.turnover_rate} />
                      </TableCell>

                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1 justify-end">
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 border-amber-200 text-amber-700 hover:bg-amber-50"
                              onClick={() => setMarkdownTarget(item)}
                            >
                              <Tag className="h-3 w-3" />
                              Markdown
                            </Button>
                          )}
                          {item.transfer_suggestion && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                              onClick={() => setTransferTarget(item)}
                            >
                              <ArrowRightLeft className="h-3 w-3" />
                              Transfer
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expanded detail row */}
                    {expanded && (
                      <TableRow key={`${key}-detail`} className={cn("border-t-0", cfg.row)}>
                        <TableCell colSpan={10} className="pb-3 pt-0 px-6">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
                            <div>
                              <p className="text-[9px] uppercase tracking-wide text-slate-400">Avg daily demand</p>
                              <p className="text-xs font-semibold text-slate-700">{item.avg_daily_demand} units/day</p>
                            </div>
                            <div>
                              <p className="text-[9px] uppercase tracking-wide text-slate-400">Unit cost</p>
                              <p className="text-xs font-semibold text-slate-700">{formatCurrency(item.unit_cost, currency)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] uppercase tracking-wide text-slate-400">Retail price</p>
                              <p className="text-xs font-semibold text-slate-700">{formatCurrency(item.retail_price, currency)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] uppercase tracking-wide text-slate-400">Forecast confidence</p>
                              <p className="text-xs font-semibold text-slate-700">{Math.round(item.confidence_score * 100)}%</p>
                            </div>

                            {/* Markdown suggestion */}
                            <div className="sm:col-span-2 rounded-md bg-amber-50 border border-amber-100 px-3 py-2">
                              <p className="text-[9px] uppercase tracking-wide text-amber-600 font-semibold mb-0.5">Suggested markdown</p>
                              <p className="text-xs text-amber-800">
                                Reduce price {item.markdown_suggestion.discount_pct}% →{" "}
                                <span className="font-semibold">{formatCurrency(item.markdown_suggestion.suggested_price, currency)}</span>
                                {" "}to accelerate turnover and free {formatCurrency(item.capital_tied, currency)} in working capital.
                              </p>
                            </div>

                            {/* Transfer suggestion */}
                            {item.transfer_suggestion ? (
                              <div className="sm:col-span-2 rounded-md bg-blue-50 border border-blue-100 px-3 py-2">
                                <p className="text-[9px] uppercase tracking-wide text-blue-600 font-semibold mb-0.5">Suggested transfer</p>
                                <p className="text-xs text-blue-800">
                                  Transfer {item.transfer_suggestion.transfer_qty} units to{" "}
                                  <span className="font-semibold">{item.transfer_suggestion.to_branch_name}</span>
                                  {item.transfer_suggestion.dest_days_of_cover !== null && (
                                    <> — currently only {item.transfer_suggestion.dest_days_of_cover}d of cover there</>
                                  )}.
                                </p>
                              </div>
                            ) : (
                              <div className="sm:col-span-2 rounded-md bg-slate-50 border border-slate-100 px-3 py-2">
                                <p className="text-[9px] uppercase tracking-wide text-slate-400 font-semibold mb-0.5">No transfer target</p>
                                <p className="text-xs text-slate-500">All other branches have sufficient stock. Markdown is the primary recommendation.</p>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-[11px] text-slate-400">
        Showing {filtered.length} of {items.length} items · Items above 60 days of demand cover · Sorted by capital tied
      </p>

      <MarkdownDialog
        item={markdownTarget}
        currency={currency}
        onClose={() => setMarkdownTarget(null)}
        onSuccess={handleSuccess}
      />
      <OverstockTransferDialog
        item={transferTarget}
        onClose={() => setTransferTarget(null)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

// ── Page header ────────────────────────────────────────────────────────────

function PageHeader({
  count, totalCapital, currency, severeCount, highCount,
}: {
  count: number; totalCapital: number; currency: string; severeCount: number; highCount: number;
}) {
  return (
    <div>
      <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <TrendingDown className="h-5 w-5 text-amber-500" />
        Overstock
      </h1>
      <p className="text-sm text-slate-500 mt-0.5">
        {count === 0
          ? "All items are within healthy stock levels"
          : <>
              {count} item{count !== 1 ? "s" : ""} with &gt;60 days of cover
              {totalCapital > 0 && <> · <span className="font-semibold text-amber-700">{formatCurrency(totalCapital, currency)}</span> tied in excess inventory</>}
              {severeCount > 0 && <> · {severeCount} severe</>}
            </>}
        {" · "}
        <span className="text-[11px] text-blue-500">AI-powered · demand from forecasts</span>
      </p>
    </div>
  );
}

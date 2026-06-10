"use client";

import { useEffect, useState, useTransition } from "react";
import { format, startOfMonth } from "date-fns";
import { Loader2, Download, TrendingUp, TrendingDown, DollarSign, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPLData, type PLData } from "@/lib/actions/reports";
import { EXPENSE_CATEGORIES } from "@/lib/constants/expenses";
import { formatCurrency, cn } from "@/lib/utils";

function toInputDate(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function catLabel(value: string) {
  return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function SummaryCard({
  label, value, sub, color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: "blue" | "green" | "red" | "amber" | "slate";
}) {
  const colors = {
    blue:  "bg-blue-50  border-blue-100  text-blue-700",
    green: "bg-green-50 border-green-100 text-green-700",
    red:   "bg-red-50   border-red-100   text-red-700",
    amber: "bg-amber-50 border-amber-100 text-amber-700",
    slate: "bg-slate-50 border-slate-200 text-slate-700",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-xl font-bold mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-[11px] mt-0.5 opacity-60">{sub}</p>}
    </div>
  );
}

function PLRow({
  label, value, currency, indent, bold, separator, dim,
}: {
  label: string;
  value?: number;
  currency: string;
  indent?: boolean;
  bold?: boolean;
  separator?: boolean;
  dim?: boolean;
}) {
  return (
    <>
      {separator && <tr><td colSpan={2} className="py-0"><div className="border-t border-slate-200 my-1" /></td></tr>}
      <tr className={cn(dim && "opacity-50")}>
        <td className={cn("py-1 text-sm text-slate-700", indent && "pl-6", bold && "font-semibold text-slate-900")}>
          {label}
        </td>
        <td className={cn("py-1 text-sm text-right tabular-nums text-slate-700", bold && "font-semibold text-slate-900")}>
          {value !== undefined ? formatCurrency(value, currency) : ""}
        </td>
      </tr>
    </>
  );
}

function exportPL(data: PLData, startDate: string, endDate: string, currency: string) {
  const rows: string[][] = [
    ["Suppliq P&L Report", `${startDate} to ${endDate}`],
    [],
    ["REVENUE"],
    ["  Retail Sales", data.revenueByType.RETAIL.toFixed(2)],
    ["  Wholesale Sales", data.revenueByType.WHOLESALE.toFixed(2)],
    ["  Special Sales", data.revenueByType.SPECIAL.toFixed(2)],
    ["Total Revenue", data.revenue.toFixed(2)],
    [],
    ["COST OF GOODS SOLD"],
    [`  Estimated COGS (${data.cogsKnownLines}/${data.cogsTotalLines} lines)`, data.cogs.toFixed(2)],
    ["Gross Profit", data.grossProfit.toFixed(2)],
    [`Gross Margin`, `${data.grossMarginPct.toFixed(1)}%`],
    [],
    ["OPERATING EXPENSES"],
    ...data.expensesByCategory.map((e) => [`  ${catLabel(e.category)}`, e.total.toFixed(2)]),
    ["Total Expenses", data.expenses.toFixed(2)],
    [],
    ["NET PROFIT", data.netProfit.toFixed(2)],
    [],
    [`Currency: ${currency}`],
  ];

  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pl-${startDate}-to-${endDate}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface Props {
  branches: { id: string; name: string }[];
  currency: string;
}

export function PLReport({ branches, currency }: Props) {
  const today = new Date();
  const [startDate, setStartDate] = useState(toInputDate(startOfMonth(today)));
  const [endDate, setEndDate] = useState(toInputDate(today));
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [data, setData] = useState<PLData | null>(null);
  const [isPending, startTransition] = useTransition();

  const tabs = branches.length > 0
    ? [{ id: null, name: "All Branches" }, ...branches.map((b) => ({ id: b.id, name: b.name }))]
    : [];

  function fetchData(start: string, end: string, branchId: string | null = activeBranchId) {
    startTransition(async () => {
      const result = await getPLData(start, end, branchId);
      setData(result);
    });
  }

  useEffect(() => { fetchData(startDate, endDate, null); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleBranchChange(branchId: string | null) {
    setActiveBranchId(branchId);
    fetchData(startDate, endDate, branchId);
  }

  if (data === null && !isPending) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
        No data
      </div>
    );
  }

  const netColor = !data ? "slate" : data.netProfit > 0 ? "green" : data.netProfit < 0 ? "red" : "slate";

  return (
    <div className="space-y-6">

      {/* Branch tabs */}
      {tabs.length > 0 && (
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.id ?? "all"}
              onClick={() => handleBranchChange(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeBranchId === tab.id
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>
      )}

      {/* Date range */}
      <div className="flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-xl p-4">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block">From</label>
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block">To</label>
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={toInputDate(today)}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <Button
          onClick={() => fetchData(startDate, endDate)}
          disabled={isPending}
          size="sm"
          className="gap-1.5 self-end"
        >
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Apply
        </Button>
        {data && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 self-end ml-auto"
            onClick={() => exportPL(data, startDate, endDate, currency)}
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        )}
      </div>

      {isPending && (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Calculating…</span>
        </div>
      )}

      {data && !isPending && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <SummaryCard
              label="Revenue"
              value={formatCurrency(data.revenue, currency)}
              sub={`${data.salesCount} sale${data.salesCount !== 1 ? "s" : ""}`}
              color="blue"
            />
            <SummaryCard
              label="Est. COGS"
              value={formatCurrency(data.cogs, currency)}
              sub={data.cogsTotalLines > 0 ? `${data.cogsKnownLines}/${data.cogsTotalLines} lines costed` : undefined}
              color="amber"
            />
            <SummaryCard
              label="Gross Profit"
              value={formatCurrency(data.grossProfit, currency)}
              sub={`${data.grossMarginPct.toFixed(1)}% margin`}
              color={data.grossProfit >= 0 ? "green" : "red"}
            />
            <SummaryCard
              label="Expenses"
              value={formatCurrency(data.expenses, currency)}
              sub={`${data.expenseCount} record${data.expenseCount !== 1 ? "s" : ""}`}
              color="slate"
            />
            <SummaryCard
              label="Net Profit"
              value={formatCurrency(data.netProfit, currency)}
              color={netColor}
            />
          </div>

          {/* Income statement */}
          <div className="grid md:grid-cols-2 gap-6">

            {/* Revenue + COGS + Gross Profit */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <h3 className="text-sm font-semibold text-slate-700">Revenue</h3>
              </div>
              <table className="w-full">
                <tbody>
                  <PLRow label="Retail Sales"     value={data.revenueByType.RETAIL}     currency={currency} indent />
                  <PLRow label="Wholesale Sales"  value={data.revenueByType.WHOLESALE}  currency={currency} indent />
                  <PLRow label="Special Sales"    value={data.revenueByType.SPECIAL}    currency={currency} indent dim={data.revenueByType.SPECIAL === 0} />
                  <PLRow label="Total Revenue"    value={data.revenue}                  currency={currency} bold separator />
                </tbody>
              </table>

              <div className="flex items-center gap-2 mt-5 mb-3">
                <BarChart3 className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-slate-700">Cost of Goods Sold</h3>
              </div>
              <table className="w-full">
                <tbody>
                  <PLRow
                    label={`Est. COGS${data.cogsKnownLines < data.cogsTotalLines ? " *" : ""}`}
                    value={data.cogs}
                    currency={currency}
                    indent
                  />
                  <PLRow label="Gross Profit"  value={data.grossProfit}     currency={currency} bold separator />
                </tbody>
              </table>
              <div className="flex justify-between text-sm mt-1 px-0">
                <span className="pl-6 text-slate-500 text-xs">Gross Margin</span>
                <span className={cn("font-semibold tabular-nums text-xs", data.grossMarginPct >= 0 ? "text-green-700" : "text-red-600")}>
                  {data.grossMarginPct.toFixed(1)}%
                </span>
              </div>

              {data.cogsKnownLines < data.cogsTotalLines && (
                <p className="text-[10px] text-slate-400 mt-3">
                  * COGS estimated using current cost prices.{" "}
                  {data.cogsTotalLines - data.cogsKnownLines} of {data.cogsTotalLines} line item{data.cogsTotalLines !== 1 ? "s" : ""} had no cost price set.
                </p>
              )}
            </div>

            {/* Expenses + Net Profit */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-700">Operating Expenses</h3>
              </div>
              <table className="w-full">
                <tbody>
                  {data.expensesByCategory.length === 0 ? (
                    <tr>
                      <td className="py-2 text-xs text-slate-400 italic">No expenses recorded in this period.</td>
                    </tr>
                  ) : (
                    data.expensesByCategory.map((e) => (
                      <PLRow key={e.category} label={catLabel(e.category)} value={e.total} currency={currency} indent />
                    ))
                  )}
                  <PLRow label="Total Expenses" value={data.expenses} currency={currency} bold separator />
                </tbody>
              </table>

              <div className="mt-5 rounded-lg border-2 border-slate-900 bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 opacity-70" />
                  <span className="text-sm font-bold">Net Profit</span>
                </div>
                <span className={cn(
                  "text-base font-bold tabular-nums",
                  data.netProfit > 0 ? "text-green-400" : data.netProfit < 0 ? "text-red-400" : "text-slate-300"
                )}>
                  {formatCurrency(data.netProfit, currency)}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { format, startOfMonth } from "date-fns";
import { Download, Loader2, BarChart3, TrendingUp, ShoppingCart } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/dashboard/metric-card";
import { VoidReceiptDialog } from "@/components/sales/void-receipt-dialog";
import { getReportData, type ReportData, type ReportSale } from "@/lib/actions/reports";
import { cn } from "@/lib/utils";

function fmtKES(v: number) {
  return `KES ${v.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-KE", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function toInputDate(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function exportCSV(sales: ReportSale[], startDate: string, endDate: string, canViewRevenue: boolean) {
  const headers = canViewRevenue
    ? [
        "Receipt #", "Date", "Cashier", "Customer",
        "Sale Type", "Total (KES)", "Tax (KES)", "Discount (KES)", "Payment",
      ]
    : ["Receipt #", "Date", "Cashier", "Customer", "Sale Type", "Payment"];

  const rows = sales.map((s) => {
    const row = [
      s.receiptNumber,
      fmtDateTime(s.createdAt),
      s.employee.name,
      s.customer?.name ?? "",
      s.saleType,
    ];

    if (canViewRevenue) {
      row.push(
        Number(s.totalAmount ?? 0).toFixed(2),
        Number(s.taxAmount ?? 0).toFixed(2),
        Number(s.discountAmount ?? 0).toFixed(2)
      );
    }

    row.push(s.paymentStatus);
    return row;
  });

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `jsh-report-${startDate}-to-${endDate}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface Props {
  role: string;
  branches: { id: string; name: string }[];
}

export function ReportsClient({ role, branches }: Props) {
  const isAdmin = role === "ADMIN";
  const tabs = isAdmin ? [{ id: null, name: "All Branches" }, ...branches.map((b) => ({ id: b.id, name: b.name }))] : [];
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);

  const today = new Date();
  const [startDate, setStartDate] = useState(toInputDate(startOfMonth(today)));
  const [endDate, setEndDate] = useState(toInputDate(today));
  const [data, setData] = useState<ReportData | null>(null);
  const [isPending, startTransition] = useTransition();
  const [voidTarget, setVoidTarget] = useState<{ saleId: string; receiptNumber: string } | null>(null);

  function fetchData(start: string, end: string, branchId: string | null = activeBranchId) {
    startTransition(async () => {
      const result = await getReportData(start, end, branchId);
      setData(result);
    });
  }

  useEffect(() => {
    fetchData(startDate, endDate, activeBranchId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleApply() {
    fetchData(startDate, endDate);
  }

  function handleBranchChange(branchId: string | null) {
    setActiveBranchId(branchId);
    fetchData(startDate, endDate, branchId);
  }

  return (
    <div className="space-y-6">

      {/* ── Branch tabs (admin only) ───────────────────────────────────────── */}
      {isAdmin && tabs.length > 0 && (
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

      {/* ── Date range picker ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-xl p-4">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block">
            From
          </label>
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block">
            To
          </label>
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={toInputDate(today)}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <Button onClick={handleApply} disabled={isPending} size="sm" className="gap-1.5 self-end">
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Apply
        </Button>
        {data && data.salesCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 self-end ml-auto"
            onClick={() => exportCSV(data.sales, startDate, endDate, data.canViewRevenue)}
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        )}
      </div>

      {/* ── Summary cards ─────────────────────────────────────────────────── */}
      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {data.canViewRevenue && (
              <div className="lg:col-span-2">
                <MetricCard
                  title="Total revenue"
                  value={fmtKES(data.totalRevenue ?? 0)}
                  icon={TrendingUp}
                  color="blue"
                />
              </div>
            )}
            <div>
              <MetricCard
                title="Sales count"
                value={String(data.salesCount)}
                icon={ShoppingCart}
                color="green"
              />
            </div>
            {data.canViewRevenue && data.revenueByType && (
              <>
                <div>
                  <MetricCard
                    title="Retail revenue"
                    value={fmtKES(data.revenueByType.RETAIL)}
                    icon={BarChart3}
                    color="blue"
                    subtitle="Retail"
                  />
                </div>
                <div>
                  <MetricCard
                    title="Wholesale revenue"
                    value={fmtKES(data.revenueByType.WHOLESALE)}
                    icon={BarChart3}
                    color="amber"
                    subtitle="Wholesale"
                  />
                </div>
              </>
            )}
          </div>

          {/* ── Sales table ─────────────────────────────────────────────── */}
          <div>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">
              Sales ({data.salesCount})
            </h2>
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden [&_th]:h-8 [&_th]:py-2 [&_th]:text-[11px] [&_td]:py-2 [&_td]:align-middle">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="w-40 whitespace-nowrap">Receipt #</TableHead>
                    <TableHead className="w-36 whitespace-nowrap">Date</TableHead>
                    <TableHead className="w-28">Cashier</TableHead>
                    <TableHead className="w-28">Customer</TableHead>
                    <TableHead className="w-20 whitespace-nowrap">Type</TableHead>
                    {data.canViewRevenue && (
                      <TableHead className="w-32 text-right whitespace-nowrap">Total</TableHead>
                    )}
                    <TableHead className="w-20 whitespace-nowrap">Payment</TableHead>
                    {isAdmin && <TableHead className="w-16" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.sales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={(data.canViewRevenue ? 7 : 6) + (isAdmin ? 1 : 0)} className="py-10 text-center text-xs text-slate-400">
                        No sales found for the selected date range.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.sales.map((sale) => (
                      <TableRow key={sale.id} className="hover:bg-slate-50/60">
                        <TableCell className="font-mono text-[11px] text-slate-500">
                          {sale.receiptNumber}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {fmtDateTime(sale.createdAt)}
                        </TableCell>
                        <TableCell className="text-xs text-slate-700 max-w-0">
                          <span className="block truncate">{sale.employee.name}</span>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 max-w-0">
                          <span className="block truncate">
                            {sale.customer?.name ?? <span className="text-slate-300">Walk-in</span>}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                            {sale.saleType}
                          </span>
                        </TableCell>
                        {data.canViewRevenue && (
                          <TableCell className="text-right text-xs font-semibold tabular-nums text-slate-800">
                            {fmtKES(Number(sale.totalAmount ?? 0))}
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge
                            className={cn(
                              "text-[10px] font-medium border px-1.5 py-0",
                              sale.paymentStatus === "PAID"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            )}
                          >
                            {sale.paymentStatus}
                          </Badge>
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[10px] font-medium text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setVoidTarget({ saleId: sale.id, receiptNumber: sale.receiptNumber })}
                            >
                              Void
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      {isPending && !data && (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading report…</span>
        </div>
      )}

      {voidTarget && (
        <VoidReceiptDialog
          saleId={voidTarget.saleId}
          receiptNumber={voidTarget.receiptNumber}
          open={true}
          onOpenChange={(open) => { if (!open) setVoidTarget(null); }}
          onSuccess={() => fetchData(startDate, endDate)}
        />
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useTransition, useMemo } from "react";
import { format, startOfMonth } from "date-fns";
import {
  ArrowDownCircle, ArrowUpCircle, Loader2, Download, Search, Package,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getStockMovements, getItemOptions,
  type StockMovementRow, type ItemOption,
} from "@/lib/actions/reports";
import { cn } from "@/lib/utils";

// ── Reason config ──────────────────────────────────────────────────────────

const REASON_META: Record<string, { label: string; dir: "in" | "out" | "adj" }> = {
  SALE:               { label: "Sale",              dir: "out" },
  SALE_VOID:          { label: "Sale Void",          dir: "in"  },
  PURCHASE_RECEIVED:  { label: "Purchase In",        dir: "in"  },
  TRANSFER_OUT:       { label: "Transfer Out",       dir: "out" },
  TRANSFER_IN:        { label: "Transfer In",        dir: "in"  },
  MANUAL_ADJUSTMENT:  { label: "Adjustment",         dir: "adj" },
};

const REASON_FILTER_OPTIONS = [
  { value: "",                  label: "All reasons" },
  { value: "SALE",              label: "Sale" },
  { value: "SALE_VOID",         label: "Sale Void" },
  { value: "PURCHASE_RECEIVED", label: "Purchase In" },
  { value: "TRANSFER_IN",       label: "Transfer In" },
  { value: "TRANSFER_OUT",      label: "Transfer Out" },
  { value: "MANUAL_ADJUSTMENT", label: "Adjustment" },
];

function reasonBadge(reason: string, quantity: number) {
  const meta = REASON_META[reason];
  const dir = meta?.dir ?? (quantity >= 0 ? "in" : "out");
  const label = meta?.label ?? reason;

  if (dir === "in") {
    return (
      <Badge className="text-[10px] font-medium border px-1.5 py-0 bg-green-50 text-green-700 border-green-200 gap-1">
        <ArrowUpCircle className="h-2.5 w-2.5" />
        {label}
      </Badge>
    );
  }
  if (dir === "out") {
    return (
      <Badge className="text-[10px] font-medium border px-1.5 py-0 bg-red-50 text-red-600 border-red-200 gap-1">
        <ArrowDownCircle className="h-2.5 w-2.5" />
        {label}
      </Badge>
    );
  }
  return (
    <Badge className="text-[10px] font-medium border px-1.5 py-0 bg-slate-100 text-slate-600 border-slate-200">
      {label}
    </Badge>
  );
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function toInputDate(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function exportCSV(rows: StockMovementRow[], startDate: string, endDate: string) {
  const headers = ["Date", "Item", "SKU", "Branch", "Qty", "Direction", "Reason", "Reference", "Recorded By"];
  const data = rows.map((r) => {
    const meta = REASON_META[r.reason];
    return [
      fmtDateTime(r.createdAt),
      r.item.name,
      r.item.sku,
      r.branch?.name ?? "",
      String(r.quantity),
      r.quantity >= 0 ? "IN" : "OUT",
      meta?.label ?? r.reason,
      r.referenceId ?? "",
      r.recordedBy.name,
    ];
  });

  const csv = [headers, ...data]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stock-movements-${startDate}-to-${endDate}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface Props {
  role: string;
  branches: { id: string; name: string }[];
}

export function StockMovementReport({ role, branches }: Props) {
  const isAdmin = role === "ADMIN";
  const today = new Date();

  const [startDate, setStartDate]     = useState(toInputDate(startOfMonth(today)));
  const [endDate, setEndDate]         = useState(toInputDate(today));
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [itemSearch, setItemSearch]   = useState("");

  const [rows, setRows]           = useState<StockMovementRow[] | null>(null);
  const [items, setItems]         = useState<ItemOption[]>([]);
  const [isPending, startTransition] = useTransition();

  // Load item list once on mount
  useEffect(() => {
    getItemOptions().then(setItems);
  }, []);

  function fetchData(
    start = startDate,
    end = endDate,
    branchId = activeBranchId,
    itemId = selectedItemId,
    reason = selectedReason,
  ) {
    startTransition(async () => {
      const result = await getStockMovements(
        start, end,
        branchId || null,
        itemId || null,
        reason || null,
      );
      setRows(result);
    });
  }

  // Initial load
  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleBranchChange(branchId: string | null) {
    setActiveBranchId(branchId);
    fetchData(startDate, endDate, branchId);
  }

  // Filter items by search text for the dropdown
  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return items;
    const q = itemSearch.toLowerCase();
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)
    );
  }, [items, itemSearch]);

  const tabs = isAdmin
    ? [{ id: null, name: "All Branches" }, ...branches.map((b) => ({ id: b.id, name: b.name }))]
    : [];

  return (
    <div className="space-y-5">

      {/* Branch tabs (admin only) */}
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

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        {/* Date row */}
        <div className="flex flex-wrap items-end gap-3">
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
          <Button onClick={() => fetchData()} disabled={isPending} size="sm" className="gap-1.5 self-end">
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Apply
          </Button>
          {rows && rows.length > 0 && (
            <Button
              variant="outline" size="sm"
              className="gap-1.5 self-end ml-auto"
              onClick={() => exportCSV(rows, startDate, endDate)}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          )}
        </div>

        {/* Item + reason filters */}
        <div className="flex flex-wrap gap-3 items-end">
          {/* Item selector with search */}
          <div className="space-y-1 min-w-[200px] relative">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block">Item</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search items…"
                value={itemSearch}
                onChange={(e) => {
                  setItemSearch(e.target.value);
                  if (!e.target.value) setSelectedItemId("");
                }}
                className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            {itemSearch && filteredItems.length > 0 && !selectedItemId && (
              <div className="absolute top-full left-0 z-20 mt-0.5 max-h-48 w-64 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                <button
                  className="w-full px-3 py-1.5 text-left text-xs text-slate-500 hover:bg-slate-50 border-b border-slate-100"
                  onClick={() => { setSelectedItemId(""); setItemSearch(""); }}
                >
                  All items
                </button>
                {filteredItems.slice(0, 30).map((item) => (
                  <button
                    key={item.id}
                    className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-baseline gap-2"
                    onClick={() => {
                      setSelectedItemId(item.id);
                      setItemSearch(`${item.name} (${item.sku})`);
                    }}
                  >
                    <span className="font-medium truncate">{item.name}</span>
                    <span className="text-slate-400 font-mono shrink-0">{item.sku}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reason filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block">Reason</label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {REASON_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {(selectedItemId || selectedReason) && (
            <Button
              variant="ghost"
              size="sm"
              className="self-end text-slate-400 hover:text-slate-700 text-xs"
              onClick={() => {
                setSelectedItemId("");
                setSelectedReason("");
                setItemSearch("");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Loading */}
      {isPending && (
        <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Loading movements…</span>
        </div>
      )}

      {/* Table */}
      {!isPending && rows !== null && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {rows.length === 0
                ? "No movements found."
                : `${rows.length} movement${rows.length !== 1 ? "s" : ""}${rows.length === 500 ? " (showing latest 500)" : ""}`}
            </p>
          </div>

          {rows.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden [&_th]:h-8 [&_th]:py-2 [&_th]:text-[11px] [&_td]:py-2 [&_td]:align-middle">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="w-36 whitespace-nowrap">Date</TableHead>
                    <TableHead className="min-w-[180px]">Item</TableHead>
                    {isAdmin && <TableHead className="w-28">Branch</TableHead>}
                    <TableHead className="w-20 text-right">Qty</TableHead>
                    <TableHead className="w-32">Reason</TableHead>
                    <TableHead className="w-28 whitespace-nowrap">Reference</TableHead>
                    <TableHead className="w-28">Recorded By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-slate-50/60">
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {fmtDateTime(row.createdAt)}
                      </TableCell>
                      <TableCell className="max-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Package className="h-3 w-3 text-slate-300 shrink-0" />
                          <span className="text-xs font-medium text-slate-700 truncate">{row.item.name}</span>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">{row.item.sku}</span>
                        </div>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                          {row.branch?.name ?? <span className="text-slate-300">-</span>}
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <span className={cn(
                          "text-sm font-bold tabular-nums",
                          row.quantity > 0 ? "text-green-600" : row.quantity < 0 ? "text-red-600" : "text-slate-400"
                        )}>
                          {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
                        </span>
                      </TableCell>
                      <TableCell>
                        {reasonBadge(row.reason, row.quantity)}
                      </TableCell>
                      <TableCell>
                        {row.referenceId ? (
                          <span
                            className="text-[10px] font-mono text-slate-400 truncate block max-w-[110px]"
                            title={row.referenceId}
                          >
                            {row.referenceId.length > 12
                              ? `${row.referenceId.slice(0, 8)}…`
                              : row.referenceId}
                          </span>
                        ) : (
                          <span className="text-slate-200">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {row.recordedBy.name}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { ShoppingBag, TrendingUp, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NewPurchaseButton } from "@/components/purchases/new-purchase-button";
import type { PurchaseOrderRow, POStats } from "@/lib/actions/purchases";
import type { SupplierRow } from "@/lib/actions/suppliers";

type Branch = { id: string; name: string };

interface PurchasesClientProps {
  orders: PurchaseOrderRow[];
  stats: POStats;
  suppliers: SupplierRow[];
  branches: Branch[];
  isAdmin: boolean;
  defaultBranchId?: string | null;
}

function fmtKES(n: number) {
  return `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function PurchasesClient({
  orders,
  stats,
  suppliers,
  branches,
  isAdmin,
  defaultBranchId,
}: PurchasesClientProps) {
  const [search, setSearch] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [filterBranch, setFilterBranch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((po) => {
      if (q && !po.poNumber.toLowerCase().includes(q) && !po.supplier.name.toLowerCase().includes(q)) {
        return false;
      }
      if (filterSupplier && po.supplier.id !== filterSupplier) return false;
      if (filterBranch && po.branch?.id !== filterBranch) return false;
      return true;
    });
  }, [orders, search, filterSupplier, filterBranch]);

  function downloadCSV() {
    const header = "PO Number,Supplier,Branch,Lines,Total Cost (KES),Date,Recorded By,Status";
    const rows = filtered.map((po) =>
      [
        po.poNumber,
        `"${po.supplier.name}"`,
        po.branch ? `"${po.branch.name}"` : "",
        po.lineCount,
        po.totalCost.toFixed(2),
        fmtDate(po.createdAt),
        `"${po.createdBy.name}"`,
        po.status,
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `purchase-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Purchase Orders</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track stock received from suppliers</p>
        </div>
        <NewPurchaseButton
          suppliers={suppliers}
          branches={branches}
          isAdmin={isAdmin}
          defaultBranchId={defaultBranchId}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: ShoppingBag, label: "Total orders", value: stats.totalOrders.toLocaleString() },
          { icon: TrendingUp, label: "Total spend", value: fmtKES(stats.totalSpend) },
          { icon: ShoppingBag, label: "This month", value: stats.thisMonthOrders.toLocaleString() },
          { icon: TrendingUp, label: "This month spend", value: fmtKES(stats.thisMonthSpend) },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="h-4 w-4 text-slate-400" />
              <p className="text-xs text-slate-500">{label}</p>
            </div>
            <p className="text-lg font-bold text-slate-800 tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Search by PO number or supplier…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <select
          value={filterSupplier}
          onChange={(e) => setFilterSupplier(e.target.value)}
          className="h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:max-w-[180px]"
        >
          <option value="">All suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {(isAdmin || branches.length > 1) && (
          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:max-w-[160px]"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
        <div className="sm:ml-auto">
          <Button variant="outline" size="sm" onClick={downloadCSV} className="gap-1.5 h-9">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <ShoppingBag className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">
              {orders.length === 0 ? "No purchase orders yet" : "No orders match your filters"}
            </p>
            {orders.length === 0 && (
              <p className="text-xs text-slate-400 mt-1">
                Record your first stock purchase to get started.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">PO Number</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Supplier</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Branch</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Lines</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total cost</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Recorded by</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700">
                      {po.poNumber}
                    </td>
                    <td className="px-4 py-3 text-slate-800 font-medium">{po.supplier.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {po.branch?.name ?? <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{po.lineCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">
                      {fmtKES(po.totalCost)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDate(po.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{po.createdBy.name}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={po.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-slate-400 text-right">
          Showing {filtered.length} of {orders.length} order{orders.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    RECEIVED: "bg-green-50 text-green-700 border-green-200",
    PARTIAL:  "bg-amber-50 text-amber-700 border-amber-200",
    PENDING:  "bg-slate-50 text-slate-600 border-slate-200",
    DRAFT:    "bg-slate-50 text-slate-400 border-slate-200",
    CANCELED: "bg-red-50 text-red-700 border-red-200",
  };
  const labels: Record<string, string> = {
    RECEIVED: "Received",
    PARTIAL:  "Partial",
    PENDING:  "Pending",
    DRAFT:    "Draft",
    CANCELED: "Canceled",
  };
  const cls = styles[status] ?? "bg-slate-50 text-slate-500 border-slate-200";
  return (
    <Badge variant="outline" className={`text-xs font-medium border ${cls}`}>
      {labels[status] ?? status}
    </Badge>
  );
}

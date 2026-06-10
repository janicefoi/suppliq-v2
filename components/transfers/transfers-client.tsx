"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Download, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { NewTransferDialog } from "@/components/transfers/new-transfer-dialog";
import type { TransferRow, TransferStats } from "@/lib/actions/transfers";

type Branch = { id: string; name: string };

interface TransfersClientProps {
  transfers: TransferRow[];
  stats: TransferStats;
  branches: Branch[];
  defaultBranchId?: string | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_CONFIG: Record<string, { label: string; style: string }> = {
  RECEIVED:   { label: "Completed",  style: "bg-green-50 text-green-700 border-green-200" },
  IN_TRANSIT: { label: "In Transit", style: "bg-blue-50 text-blue-700 border-blue-200" },
  PENDING:    { label: "Pending",    style: "bg-amber-50 text-amber-700 border-amber-200" },
  CANCELLED:  { label: "Cancelled",  style: "bg-red-50 text-red-700 border-red-200" },
};

export function TransfersClient({
  transfers,
  stats,
  branches,
  defaultBranchId,
}: TransfersClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return transfers.filter((t) => {
      if (
        q &&
        !t.fromBranch.name.toLowerCase().includes(q) &&
        !t.toBranch.name.toLowerCase().includes(q) &&
        !t.items.some((i) => i.item.name.toLowerCase().includes(q))
      ) {
        return false;
      }
      if (
        filterBranch &&
        t.fromBranch.id !== filterBranch &&
        t.toBranch.id !== filterBranch
      ) {
        return false;
      }
      return true;
    });
  }, [transfers, search, filterBranch]);

  function downloadCSV() {
    const header = "Date,From Branch,To Branch,Items,Total Units,Recorded By,Status";
    const rows = filtered.map((t) =>
      [
        fmtDate(t.createdAt),
        `"${t.fromBranch.name}"`,
        `"${t.toBranch.name}"`,
        t.lineCount,
        t.totalQty,
        `"${t.createdBy.name}"`,
        STATUS_CONFIG[t.status]?.label ?? t.status,
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-transfers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Stock Transfers</h1>
          <p className="text-sm text-slate-500 mt-0.5">Move inventory between branches</p>
        </div>
        {branches.length >= 2 ? (
          <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
            <ArrowLeftRight className="h-4 w-4" />
            New transfer
          </Button>
        ) : (
          <p className="text-sm text-slate-400 italic">At least 2 active branches are needed to transfer stock.</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total transfers",       value: stats.totalTransfers.toLocaleString() },
          { label: "Total units moved",     value: stats.totalItemsMoved.toLocaleString() },
          { label: "This month",            value: stats.thisMonthTransfers.toLocaleString() },
          { label: "Units this month",      value: stats.thisMonthItemsMoved.toLocaleString() },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className="text-lg font-bold text-slate-800 tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Search by branch or item name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <select
          value={filterBranch}
          onChange={(e) => setFilterBranch(e.target.value)}
          className="h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:max-w-[180px]"
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
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
            <ArrowLeftRight className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">
              {transfers.length === 0 ? "No stock transfers yet" : "No transfers match your filters"}
            </p>
            {transfers.length === 0 && branches.length >= 2 && (
              <p className="text-xs text-slate-400 mt-1">
                Record your first transfer to start moving stock between branches.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">From</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">To</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Items</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Units</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Recorded by</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((t) => {
                  const cfg = STATUS_CONFIG[t.status] ?? { label: t.status, style: "bg-slate-50 text-slate-500 border-slate-200" };
                  const isExpanded = expandedId === t.id;
                  return (
                    <>
                      <tr
                        key={t.id}
                        className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : t.id)}
                      >
                        <td className="px-4 py-3 font-medium text-slate-800">{t.fromBranch.name}</td>
                        <td className="px-4 py-3 text-slate-800">{t.toBranch.name}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-600">{t.lineCount}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">{t.totalQty.toLocaleString()}</td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">{fmtDate(t.createdAt)}</td>
                        <td className="px-4 py-3 text-slate-600">{t.createdBy.name}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-xs font-medium border ${cfg.style}`}>
                            {cfg.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs text-slate-400">{isExpanded ? "▲" : "▼"}</span>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr key={`${t.id}-detail`} className="bg-slate-50">
                          <td colSpan={8} className="px-6 pb-4 pt-2">
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Items transferred</p>
                              <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50">
                                      <th className="text-left px-3 py-2 font-semibold text-slate-500">Item</th>
                                      <th className="text-left px-3 py-2 font-semibold text-slate-500">SKU</th>
                                      <th className="text-right px-3 py-2 font-semibold text-slate-500">Quantity</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                    {t.items.map((line, i) => (
                                      <tr key={i}>
                                        <td className="px-3 py-2 text-slate-700 font-medium">{line.item.name}</td>
                                        <td className="px-3 py-2 font-mono text-slate-500">{line.item.sku}</td>
                                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-700">{line.quantity}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              {t.notes && (
                                <p className="text-xs text-slate-500 italic">Note: {t.notes}</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-slate-400 text-right">
          Showing {filtered.length} of {transfers.length} transfer{transfers.length !== 1 ? "s" : ""}
        </p>
      )}

      <NewTransferDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => {
          setDialogOpen(false);
          router.refresh();
        }}
        branches={branches}
        defaultFromBranchId={defaultBranchId}
      />
    </div>
  );
}

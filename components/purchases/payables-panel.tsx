"use client";

import { useState, useMemo } from "react";
import { CheckCircle2, Clock, AlertCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { markInvoicePaid } from "@/lib/actions/purchases";
import { formatCurrency } from "@/lib/utils";
import type { PayableRow } from "@/lib/actions/purchases";

interface PayablesPanelProps {
  payables: PayableRow[];
  isAdmin: boolean;
  currency: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function InvoiceStatusBadge({ status }: { status: string }) {
  if (status === "PAID") {
    return <Badge variant="outline" className="text-xs border-green-200 bg-green-50 text-green-700">Paid</Badge>;
  }
  if (status === "DISPUTED") {
    return <Badge variant="outline" className="text-xs border-red-200 bg-red-50 text-red-700">Disputed</Badge>;
  }
  return <Badge variant="outline" className="text-xs border-amber-200 bg-amber-50 text-amber-700">Unpaid</Badge>;
}

function daysDue(invoiceDate: string) {
  const d = Math.floor((Date.now() - new Date(invoiceDate).getTime()) / 86400000);
  return d;
}

export function PayablesPanel({ payables, isAdmin, currency }: PayablesPanelProps) {
  const [paying, setPaying] = useState<string | null>(null);
  const [localPaid, setLocalPaid] = useState<Set<string>>(new Set());

  const rows = useMemo(() => payables.map((p) => ({
    ...p,
    invoiceStatus: localPaid.has(p.id) ? "PAID" : p.invoiceStatus,
    invoicePaidAt: localPaid.has(p.id) ? new Date().toISOString() : p.invoicePaidAt,
  })), [payables, localPaid]);

  const unpaid = rows.filter((r) => r.invoiceStatus === "RECEIVED");
  const paid = rows.filter((r) => r.invoiceStatus === "PAID");
  const totalUnpaid = unpaid.reduce((s, r) => s + r.invoiceAmount, 0);
  const totalPaid = paid.reduce((s, r) => s + r.invoiceAmount, 0);

  async function handleMarkPaid(poId: string) {
    setPaying(poId);
    const result = await markInvoicePaid(poId);
    setPaying(null);
    if (result.success) {
      setLocalPaid((prev) => new Set([...prev, poId]));
    }
  }

  function downloadCSV() {
    const header = `PO Number,Supplier,Invoice Ref,Invoice Amount (${currency}),Invoice Date,Days Outstanding,Status,Paid At`;
    const csvRows = rows.map((r) =>
      [
        r.poNumber,
        `"${r.supplier.name}"`,
        `"${r.invoiceRef}"`,
        (r.invoiceAmount / 100).toFixed(2),
        fmtDate(r.invoiceDate),
        r.invoiceStatus === "PAID" ? "0" : daysDue(r.invoiceDate).toString(),
        r.invoiceStatus,
        r.invoicePaidAt ? fmtDate(r.invoicePaidAt) : "",
      ].join(",")
    );
    const csv = [header, ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payables-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (rows.length === 0) {
    return (
      <div className="py-16 text-center rounded-xl border border-slate-200 bg-white">
        <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">No invoices linked yet</p>
        <p className="text-xs text-slate-400 mt-1">
          Link supplier invoices to received purchase orders using the button in the Orders tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-amber-500" />
            <p className="text-xs text-amber-700">Outstanding</p>
          </div>
          <p className="text-lg font-bold text-amber-800 tabular-nums">
            {formatCurrency(totalUnpaid, currency)}
          </p>
          <p className="text-xs text-amber-600 mt-0.5">{unpaid.length} invoice{unpaid.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <p className="text-xs text-green-700">Paid</p>
          </div>
          <p className="text-lg font-bold text-green-800 tabular-nums">
            {formatCurrency(totalPaid, currency)}
          </p>
          <p className="text-xs text-green-600 mt-0.5">{paid.length} invoice{paid.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="h-4 w-4 text-slate-400" />
            <p className="text-xs text-slate-500">Total invoiced</p>
          </div>
          <p className="text-lg font-bold text-slate-800 tabular-nums">
            {formatCurrency(totalUnpaid + totalPaid, currency)}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{rows.length} invoice{rows.length !== 1 ? "s" : ""} total</p>
        </div>
      </div>

      {/* Table */}
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-slate-700">All invoices</h3>
        <Button variant="outline" size="sm" onClick={downloadCSV} className="gap-1.5 h-8 text-xs">
          <Download className="h-3 w-3" />
          Export CSV
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">PO</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Supplier</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Invoice ref</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Invoice amount</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">PO cost</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Invoice date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Age</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                {isAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((r) => {
                const days = daysDue(r.invoiceDate);
                const isPaid = r.invoiceStatus === "PAID";
                const variance = r.invoiceAmount - r.poTotalCost;

                return (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700 whitespace-nowrap">
                      {r.poNumber}
                    </td>
                    <td className="px-4 py-3 text-slate-800 font-medium max-w-[160px] truncate">
                      {r.supplier.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.invoiceRef}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">
                      {formatCurrency(r.invoiceAmount, currency)}
                      {Math.abs(variance) > 1 && (
                        <span className={`ml-1.5 text-[10px] font-normal ${variance > 0 ? "text-red-500" : "text-green-500"}`}>
                          {variance > 0 ? "+" : ""}{formatCurrency(variance, currency)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500 text-xs">
                      {formatCurrency(r.poTotalCost, currency)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">{fmtDate(r.invoiceDate)}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {isPaid ? (
                        <span className="text-slate-400">
                          Paid {r.invoicePaidAt ? fmtDate(r.invoicePaidAt) : ""}
                        </span>
                      ) : (
                        <span className={days > 30 ? "text-red-600 font-medium" : days > 14 ? "text-amber-600" : "text-slate-500"}>
                          {days}d
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <InvoiceStatusBadge status={r.invoiceStatus} />
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        {!isPaid && r.invoiceStatus === "RECEIVED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 text-green-700 border-green-200 hover:bg-green-50"
                            disabled={paying === r.id}
                            onClick={() => handleMarkPaid(r.id)}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {paying === r.id ? "Saving…" : "Mark paid"}
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

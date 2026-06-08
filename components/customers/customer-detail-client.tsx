"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Pencil, CreditCard, Phone, MapPin, Calendar,
  ShoppingBag, Receipt, TrendingUp, Printer, GitBranch,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CustomerDialog } from "@/components/customers/customer-dialog";
import { RecordPaymentDialog } from "@/components/customers/record-payment-dialog";
import type { CustomerDetail, CustomerRow } from "@/lib/actions/customers";
import { cn } from "@/lib/utils";

function fmtKES(v: string | number) {
  return `KES ${Number(v).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-KE", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
function monthKey(iso: string) { return iso.slice(0, 7); } // "2026-06"
function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-KE", { month: "long", year: "numeric" });
}

interface Props {
  customer: CustomerDetail;
  role: string;
}

export function CustomerDetailClient({ customer, role }: Props) {
  const canEdit = role !== "CASHIER";
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [period, setPeriod] = useState<string>("all");

  const balance = Number(customer.creditBalance);
  const hasCredit = balance > 0;

  // Build month options from sales + payments
  const monthOptions = useMemo(() => {
    const keys = new Set<string>();
    customer.sales.forEach((s) => keys.add(monthKey(s.createdAt)));
    customer.creditPayments.forEach((p) => keys.add(monthKey(p.createdAt)));
    return Array.from(keys).sort().reverse();
  }, [customer.sales, customer.creditPayments]);

  // Filtered sales and payments for selected period
  const filteredSales = useMemo(() =>
    period === "all" ? customer.sales : customer.sales.filter((s) => monthKey(s.createdAt) === period),
    [customer.sales, period]
  );
  const filteredPayments = useMemo(() =>
    period === "all" ? customer.creditPayments : customer.creditPayments.filter((p) => monthKey(p.createdAt) === period),
    [customer.creditPayments, period]
  );

  // Summary stats (all-time)
  const totalSpent = customer.sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
  const periodSpent = filteredSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
  const periodPaid = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const lastSale = customer.sales[0];

  function handleSuccess() {
    setEditOpen(false);
    setPaymentOpen(false);
    startTransition(() => router.refresh());
  }

  const customerAsRow: CustomerRow = {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    address: customer.address,
    creditBalance: customer.creditBalance,
    createdAt: customer.createdAt,
    branchId: customer.branchId,
    branch: customer.branch,
    _count: { sales: customer.sales.length },
  };

  const printPeriodLabel = period === "all" ? "All time" : monthLabel(period);

  return (
    <div className="space-y-6">

      {/* ── Back + Actions ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Link href="/customers" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Customers
        </Link>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => window.print()}
          >
            <Printer className="h-3.5 w-3.5" />
            Print statement
          </Button>
          {canEdit && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* ── Top cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Info card */}
        <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h1 className="text-xl font-bold text-slate-900">{customer.name}</h1>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Phone className="h-4 w-4 text-slate-400 shrink-0" />
              {customer.phone}
            </div>
            {customer.address && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                {customer.address}
              </div>
            )}
            {customer.branch && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <GitBranch className="h-4 w-4 text-slate-400 shrink-0" />
                {customer.branch.name}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
              Customer since {fmtDate(customer.createdAt)}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <ShoppingBag className="h-4 w-4 text-slate-400 shrink-0" />
              {customer.sales.length} purchase{customer.sales.length !== 1 ? "s" : ""}
              {lastSale && <span className="text-slate-400">· Last on {fmtDate(lastSale.createdAt)}</span>}
            </div>
          </div>
        </div>

        {/* Credit balance card */}
        <div className={cn("rounded-xl border p-5 flex flex-col justify-between", hasCredit ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50")}>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-2">
              <CreditCard className={cn("h-3.5 w-3.5", hasCredit ? "text-red-500" : "text-green-500")} />
              <span className={hasCredit ? "text-red-600" : "text-green-600"}>Credit balance</span>
            </div>
            <p className={cn("text-3xl font-bold tabular-nums", hasCredit ? "text-red-700" : "text-green-700")}>
              {fmtKES(balance)}
            </p>
            <p className="text-xs mt-1">
              {hasCredit ? <span className="text-red-500">Amount owed to JSH</span> : <span className="text-green-600">No outstanding balance</span>}
            </p>
          </div>
          <Button
            size="sm"
            disabled={!hasCredit}
            className={cn("mt-4 w-full gap-1.5", hasCredit ? "bg-red-600 hover:bg-red-700 text-white" : "bg-green-600 hover:bg-green-700 text-white opacity-50 cursor-not-allowed")}
            onClick={() => hasCredit && setPaymentOpen(true)}
          >
            <CreditCard className="h-3.5 w-3.5" />
            Record payment
          </Button>
        </div>
      </div>

      {/* ── Summary stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total spent", value: fmtKES(totalSpent), sub: "all time", icon: TrendingUp, color: "text-blue-600" },
          { label: "Purchases", value: String(customer.sales.length), sub: "all time", icon: ShoppingBag, color: "text-slate-700" },
          { label: "Total paid (credit)", value: fmtKES(customer.creditPayments.reduce((s, p) => s + Number(p.amount), 0)), sub: "all time", icon: Receipt, color: "text-green-600" },
          { label: "Outstanding", value: fmtKES(balance), sub: "current balance", icon: CreditCard, color: hasCredit ? "text-red-600" : "text-green-600" },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className={cn("h-3.5 w-3.5", color)} />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
            </div>
            <p className={cn("text-lg font-bold tabular-nums", color)}>{value}</p>
            <p className="text-[10px] text-slate-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Period filter ─────────────────────────────────────────────────── */}
      {monthOptions.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-500">View period:</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
          >
            <option value="all">All time</option>
            {monthOptions.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
          {period !== "all" && (
            <span className="text-xs text-slate-500">
              {filteredSales.length} sale{filteredSales.length !== 1 ? "s" : ""} · {fmtKES(periodSpent)} spent
              {periodPaid > 0 && ` · ${fmtKES(periodPaid)} paid`}
            </span>
          )}
        </div>
      )}

      {/* ── Purchase history ──────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
          <ShoppingBag className="h-4 w-4 text-slate-400" />
          Purchase history
          {period !== "all" && <span className="text-slate-400 font-normal">— {monthLabel(period)}</span>}
        </h2>
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden [&_th]:h-8 [&_th]:py-2 [&_th]:text-[11px] [&_td]:py-2 [&_td]:align-middle">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="w-44 whitespace-nowrap">Receipt #</TableHead>
                <TableHead className="w-36 whitespace-nowrap">Date</TableHead>
                <TableHead className="w-24 whitespace-nowrap">Type</TableHead>
                <TableHead className="w-32 text-right whitespace-nowrap">Total</TableHead>
                <TableHead className="w-24 whitespace-nowrap">Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-xs text-slate-400">
                    No purchases {period !== "all" ? `in ${monthLabel(period)}` : "yet"}.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {filteredSales.map((sale) => (
                    <TableRow key={sale.id} className="hover:bg-slate-50/60">
                      <TableCell className="font-mono text-[11px] text-slate-500">{sale.receiptNumber}</TableCell>
                      <TableCell className="text-xs text-slate-600">{fmtDateTime(sale.createdAt)}</TableCell>
                      <TableCell>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{sale.saleType}</span>
                      </TableCell>
                      <TableCell className="text-right text-xs font-semibold tabular-nums text-slate-800">{fmtKES(sale.totalAmount)}</TableCell>
                      <TableCell>
                        <Badge className={cn("text-[10px] font-medium border px-1.5 py-0", sale.paymentStatus === "PAID" ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200")}>
                          {sale.paymentStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredSales.length > 1 && (
                    <TableRow className="bg-slate-50 font-semibold">
                      <TableCell colSpan={3} className="text-xs text-slate-500">Total</TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-slate-900">{fmtKES(periodSpent)}</TableCell>
                      <TableCell />
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* ── Credit payment history ────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
          <Receipt className="h-4 w-4 text-slate-400" />
          Credit payment history
          {period !== "all" && <span className="text-slate-400 font-normal">— {monthLabel(period)}</span>}
        </h2>
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden [&_th]:h-8 [&_th]:py-2 [&_th]:text-[11px] [&_td]:py-2 [&_td]:align-middle">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="w-36 whitespace-nowrap">Date</TableHead>
                <TableHead className="w-32 text-right whitespace-nowrap">Amount</TableHead>
                <TableHead className="min-w-[200px]">Notes</TableHead>
                <TableHead className="w-36 whitespace-nowrap">Recorded by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-xs text-slate-400">
                    No credit payments {period !== "all" ? `in ${monthLabel(period)}` : "recorded yet"}.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((p) => (
                  <TableRow key={p.id} className="hover:bg-slate-50/60">
                    <TableCell className="text-xs text-slate-600">{fmtDateTime(p.createdAt)}</TableCell>
                    <TableCell className="text-right text-xs font-semibold tabular-nums text-green-700">{fmtKES(p.amount)}</TableCell>
                    <TableCell className="text-xs text-slate-500">{p.notes ?? <span className="text-slate-300">—</span>}</TableCell>
                    <TableCell className="text-xs text-slate-600">{p.recordedBy.name}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* ── Printable statement (hidden on screen, shown on print) ─────────── */}
      <div className="customer-statement-print" style={{ display: "none" }}>
        <div style={{ borderBottom: "2px solid #0f172a", paddingBottom: 12, marginBottom: 16 }}>
          <p style={{ fontWeight: 700, fontSize: 18, margin: 0 }}>JSH MOTORCYCLE SPARE PARTS</p>
          {customer.branch && (
            <>
              <p style={{ margin: "2px 0", fontSize: 13 }}>{customer.branch.name}</p>
              {customer.branch.address && <p style={{ margin: "2px 0", fontSize: 12, color: "#475569" }}>{customer.branch.address}</p>}
              {customer.branch.phone && <p style={{ margin: "2px 0", fontSize: 12, color: "#475569" }}>Tel: {customer.branch.phone}</p>}
              {customer.branch.paybill && <p style={{ margin: "2px 0", fontSize: 12, color: "#475569" }}>Paybill: {customer.branch.paybill}</p>}
            </>
          )}
        </div>

        <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>CUSTOMER ACCOUNT STATEMENT</p>
        <p style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>Period: <strong>{printPeriodLabel}</strong></p>
        <p style={{ fontSize: 12, color: "#475569", marginBottom: 12 }}>Printed: {fmtDateTime(new Date().toISOString())}</p>

        <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 10, marginBottom: 12 }}>
          <p style={{ fontWeight: 700, fontSize: 13, margin: "0 0 4px" }}>{customer.name}</p>
          <p style={{ fontSize: 12, margin: "2px 0", color: "#475569" }}>Phone: {customer.phone}</p>
          {customer.address && <p style={{ fontSize: 12, margin: "2px 0", color: "#475569" }}>Address: {customer.address}</p>}
        </div>

        {/* Sales table */}
        <p style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>PURCHASES</p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 16 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #0f172a" }}>
              <th style={{ textAlign: "left", padding: "4px 6px" }}>Receipt #</th>
              <th style={{ textAlign: "left", padding: "4px 6px" }}>Date</th>
              <th style={{ textAlign: "left", padding: "4px 6px" }}>Type</th>
              <th style={{ textAlign: "right", padding: "4px 6px" }}>Total (KES)</th>
              <th style={{ textAlign: "left", padding: "4px 6px" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: "8px 6px", color: "#94a3b8" }}>No purchases in this period.</td></tr>
            ) : (
              filteredSales.map((s) => (
                <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "4px 6px", fontFamily: "monospace" }}>{s.receiptNumber}</td>
                  <td style={{ padding: "4px 6px" }}>{fmtDateTime(s.createdAt)}</td>
                  <td style={{ padding: "4px 6px" }}>{s.saleType}</td>
                  <td style={{ padding: "4px 6px", textAlign: "right" }}>{Number(s.totalAmount).toLocaleString("en-KE", { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: "4px 6px" }}>{s.paymentStatus}</td>
                </tr>
              ))
            )}
            {filteredSales.length > 0 && (
              <tr style={{ borderTop: "1px solid #0f172a", fontWeight: 700 }}>
                <td colSpan={3} style={{ padding: "4px 6px" }}>Total purchases</td>
                <td style={{ padding: "4px 6px", textAlign: "right" }}>{periodSpent.toLocaleString("en-KE", { minimumFractionDigits: 2 })}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>

        {/* Payments table */}
        <p style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>CREDIT PAYMENTS RECEIVED</p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 16 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #0f172a" }}>
              <th style={{ textAlign: "left", padding: "4px 6px" }}>Date</th>
              <th style={{ textAlign: "right", padding: "4px 6px" }}>Amount (KES)</th>
              <th style={{ textAlign: "left", padding: "4px 6px" }}>Notes</th>
              <th style={{ textAlign: "left", padding: "4px 6px" }}>Recorded by</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: "8px 6px", color: "#94a3b8" }}>No payments in this period.</td></tr>
            ) : (
              filteredPayments.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "4px 6px" }}>{fmtDateTime(p.createdAt)}</td>
                  <td style={{ padding: "4px 6px", textAlign: "right" }}>{Number(p.amount).toLocaleString("en-KE", { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: "4px 6px" }}>{p.notes ?? "—"}</td>
                  <td style={{ padding: "4px 6px" }}>{p.recordedBy.name}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Balance summary */}
        <div style={{ borderTop: "2px solid #0f172a", paddingTop: 10, marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
            <span>Total purchases ({printPeriodLabel})</span>
            <strong>KES {periodSpent.toLocaleString("en-KE", { minimumFractionDigits: 2 })}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
            <span>Total payments ({printPeriodLabel})</span>
            <strong>KES {periodPaid.toLocaleString("en-KE", { minimumFractionDigits: 2 })}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, borderTop: "1px solid #0f172a", paddingTop: 6, marginTop: 6 }}>
            <span>Outstanding balance</span>
            <span style={{ color: hasCredit ? "#dc2626" : "#16a34a" }}>KES {balance.toLocaleString("en-KE", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 24, textAlign: "center" }}>
          This is an official statement from JSH Motorcycle Spare Parts. For enquiries contact us on the details above.
        </p>
      </div>

      {/* ── Dialogs ───────────────────────────────────────────────────────── */}
      <CustomerDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        customer={customerAsRow}
        onSuccess={handleSuccess}
      />
      <RecordPaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        customerId={customer.id}
        customerName={customer.name}
        creditBalance={balance}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

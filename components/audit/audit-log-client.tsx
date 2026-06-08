"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { getAuditLogs } from "@/lib/actions/audit";

type AuditData = Awaited<ReturnType<typeof getAuditLogs>>;

function fmtKES(v: string | number) {
  return `KES ${Number(v).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDateTime(d: Date) {
  return new Date(d).toLocaleString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  data: AuditData;
}

type Tab = "payments" | "inventory";

export function AuditLogClient({ data }: Props) {
  const [tab, setTab] = useState<Tab>("payments");
  const [search, setSearch] = useState("");

  const q = search.toLowerCase();

  const payments = data.creditPayments.filter(
    (p) =>
      p.customer.name.toLowerCase().includes(q) ||
      p.recordedBy.name.toLowerCase().includes(q) ||
      (p.notes ?? "").toLowerCase().includes(q)
  );

  const orders = data.stockLogs.filter(
    (o) =>
      o.item.name.toLowerCase().includes(q) ||
      o.item.sku.toLowerCase().includes(q) ||
      o.recordedBy.name.toLowerCase().includes(q) ||
      (o.branch?.name ?? "").toLowerCase().includes(q)
  );

  return (
    <div className="space-y-4">
      {/* Tabs + search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
          <button
            onClick={() => { setTab("payments"); setSearch(""); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === "payments"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Customer payments
            <span className="ml-2 text-xs bg-muted-foreground/20 rounded-full px-2 py-0.5">
              {data.creditPayments.length}
            </span>
          </button>
          <button
            onClick={() => { setTab("inventory"); setSearch(""); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === "inventory"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Inventory stock-in
            <span className="ml-2 text-xs bg-muted-foreground/20 rounded-full px-2 py-0.5">
              {data.stockLogs.length}
            </span>
          </button>
        </div>

        <div className="relative sm:ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-64"
          />
        </div>
      </div>

      {/* Payments table */}
      {tab === "payments" && (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Recorded by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {fmtDateTime(p.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium">{p.customer.name}</TableCell>
                    <TableCell className="text-right font-semibold text-green-600">
                      {fmtKES(Number(p.amount))}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {p.notes ?? "—"}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs flex items-center justify-center uppercase">
                          {p.recordedBy.name.charAt(0)}
                        </span>
                        {p.recordedBy.name}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {payments.length > 0 && (
            <p className="text-xs text-muted-foreground px-4 py-2 border-t">
              Showing {payments.length} of {data.creditPayments.length} record{data.creditPayments.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      {/* Inventory stock-in table */}
      {tab === "inventory" && (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Qty added</TableHead>
                <TableHead>Recorded by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    No records found
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {fmtDateTime(o.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium">{o.item.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm font-mono">
                      {o.item.sku}
                    </TableCell>
                    <TableCell>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {o.branch?.name ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold">+{o.quantity}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs flex items-center justify-center uppercase">
                          {o.recordedBy.name.charAt(0)}
                        </span>
                        {o.recordedBy.name}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {orders.length > 0 && (
            <p className="text-xs text-muted-foreground px-4 py-2 border-t">
              Showing {orders.length} of {data.stockLogs.length} record{data.stockLogs.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

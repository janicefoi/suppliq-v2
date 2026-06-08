"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VoidReceiptDialog } from "@/components/sales/void-receipt-dialog";
import type { RecentSale } from "@/lib/actions/dashboard";
import { cn } from "@/lib/utils";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtKES(v: string | number) {
  return `KES ${Number(v).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface Props {
  sales: RecentSale[];
  isAdmin?: boolean;
}

export function RecentSalesTable({ sales, isAdmin }: Props) {
  const router = useRouter();
  const [voidTarget, setVoidTarget] = useState<{ saleId: string; receiptNumber: string } | null>(null);

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-700 mb-3">Recent sales</h2>
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden [&_th]:h-8 [&_th]:py-2 [&_th]:text-[11px] [&_td]:py-2 [&_td]:align-middle">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="w-36 whitespace-nowrap">Receipt #</TableHead>
              <TableHead className="w-14 whitespace-nowrap">Time</TableHead>
              <TableHead className="w-28">Cashier</TableHead>
              <TableHead className="w-20 whitespace-nowrap">Type</TableHead>
              <TableHead className="w-28 text-right whitespace-nowrap">Total</TableHead>
              <TableHead className="w-20 whitespace-nowrap">Payment</TableHead>
              <TableHead className="w-16 whitespace-nowrap">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-xs text-slate-400">
                  No sales today yet.
                </TableCell>
              </TableRow>
            ) : (
              sales.map((sale) => (
                <TableRow
                  key={sale.id}
                  className={cn(
                    "hover:bg-slate-50/60 transition-colors",
                    sale.isVoid && "opacity-50"
                  )}
                >
                  <TableCell className="font-mono text-[11px] text-slate-500">
                    {sale.receiptNumber}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 tabular-nums">
                    {fmtTime(sale.createdAt)}
                  </TableCell>
                  <TableCell className="text-xs text-slate-700 max-w-0">
                    <span className="block truncate">{sale.employee.name}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                      {sale.saleType}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-xs font-semibold tabular-nums text-slate-800">
                    {fmtKES(sale.totalAmount)}
                  </TableCell>
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
                  <TableCell>
                    {sale.isVoid ? (
                      <Badge className="text-[10px] font-medium border px-1.5 py-0 bg-red-50 text-red-600 border-red-200">
                        VOID
                      </Badge>
                    ) : isAdmin ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-[10px] font-medium text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setVoidTarget({ saleId: sale.id, receiptNumber: sale.receiptNumber })}
                      >
                        Void
                      </Button>
                    ) : (
                      <span className="text-[10px] text-slate-300">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {voidTarget && (
        <VoidReceiptDialog
          saleId={voidTarget.saleId}
          receiptNumber={voidTarget.receiptNumber}
          open={true}
          onOpenChange={(open) => { if (!open) setVoidTarget(null); }}
          onSuccess={() => router.refresh()}
        />
      )}
    </div>
  );
}

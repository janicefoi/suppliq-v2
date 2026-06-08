"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, Printer, ShoppingCart } from "lucide-react";
import type { SaleResult } from "@/lib/actions/pos";

interface ReceiptModalProps {
  sale: SaleResult;
  onClose: () => void;
}

function fmt(v: string | number) {
  const n = Number(v);
  return `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReceiptModal({ sale, onClose }: ReceiptModalProps) {
  const subtotal = sale.items.reduce((sum, i) => sum + Number(i.subtotal), 0);
  const discount = Number(sale.discountAmount);
  const tax = Number(sale.taxAmount);
  const total = Number(sale.totalAmount);
  const branch = sale.branch;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden">
        {/* Success banner */}
        <div className="bg-green-50 px-4 py-3 flex items-center gap-2 border-b border-green-100">
          <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
          <p className="text-sm font-semibold text-green-800">Sale Complete</p>
        </div>

        {/* Receipt body */}
        <div className="px-6 py-4 space-y-3 max-h-[65vh] overflow-y-auto text-xs">

          {/* Branch header */}
          <div className="text-center space-y-0.5 pb-1">
            <p className="font-bold text-sm text-slate-900 uppercase tracking-wide">
              JSH Motorcycle Spare Parts
            </p>
            {branch?.name && (
              <p className="font-semibold text-slate-700">{branch.name}</p>
            )}
            {branch?.address && (
              <p className="text-slate-500">{branch.address}</p>
            )}
            {branch?.phone && (
              <p className="text-slate-500">Tel: {branch.phone}</p>
            )}
            {branch?.paybill && (
              <p className="text-slate-500">Paybill: <span className="font-medium text-slate-700">{branch.paybill}</span></p>
            )}
            {branch?.pin && (
              <p className="text-slate-500">PIN: <span className="font-medium text-slate-700">{branch.pin}</span></p>
            )}
          </div>

          <Separator />

          {/* Receipt number & date */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-slate-500">
              <span>Receipt #</span>
              <span className="font-mono font-medium text-slate-700">{sale.receiptNumber}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Date</span>
              <span className="text-slate-700">{formatDate(sale.createdAt)}</span>
            </div>
          </div>

          <Separator />

          {/* Transaction meta */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-slate-500">
              <span>Sale type</span>
              <span className="font-medium text-slate-700">{sale.saleType}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Payment</span>
              <span className={`font-medium ${sale.paymentStatus === "CREDIT" ? "text-amber-600" : "text-green-600"}`}>
                {sale.paymentStatus}
              </span>
            </div>
            {sale.customer && (
              <div className="flex justify-between text-slate-500">
                <span>Customer</span>
                <span className="font-medium text-slate-700">{sale.customer.name}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-500">
              <span>Served by</span>
              <span className="font-medium text-slate-700">{sale.employee.name}</span>
            </div>
          </div>

          <Separator />

          {/* Items */}
          <div className="space-y-2">
            {sale.items.map((line, idx) => (
              <div key={idx}>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{line.item.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{line.item.sku}</p>
                  </div>
                  <p className="font-semibold text-slate-800 tabular-nums shrink-0">
                    {fmt(line.subtotal)}
                  </p>
                </div>
                <p className="text-[10px] text-slate-400 tabular-nums">
                  {line.quantity} × {fmt(line.unitPrice)}
                </p>
              </div>
            ))}
          </div>

          <Separator />

          {/* Totals */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span className="tabular-nums">{fmt(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-red-500">
                <span>Discount</span>
                <span className="tabular-nums">− {fmt(discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-500">
              <span>VAT (16% incl.)</span>
              <span className="tabular-nums">{fmt(tax)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-900 text-sm pt-1 border-t border-slate-200">
              <span>Total</span>
              <span className="tabular-nums">{fmt(total)}</span>
            </div>
          </div>

          <p className="text-center text-[10px] text-slate-400 pt-1">Thank you for your business!</p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex gap-2 border-t border-slate-100 pt-4">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => window.print()}
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1.5"
            onClick={onClose}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            New Sale
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

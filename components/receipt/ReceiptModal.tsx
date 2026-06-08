"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ThermalReceipt } from "./ThermalReceipt";
import { getSaleById } from "@/lib/actions/pos";
import type { SaleResult } from "@/lib/actions/pos";

interface ReceiptModalProps {
  saleId: string;
  amountGiven?: number;
  onClose: () => void;
}

export function ReceiptModal({ saleId, amountGiven = 0, onClose }: ReceiptModalProps) {
  const [sale, setSale] = useState<SaleResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const afterPrintRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    getSaleById(saleId)
      .then((s) => {
        if (s) setSale(s);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [saleId]);

  // Clean up afterprint listener on unmount
  useEffect(() => {
    return () => {
      if (afterPrintRef.current) {
        window.removeEventListener("afterprint", afterPrintRef.current);
      }
    };
  }, []);

  function handlePrint() {
    if (afterPrintRef.current) {
      window.removeEventListener("afterprint", afterPrintRef.current);
    }
    const cleanup = () => {
      document.body.classList.remove("printing-receipt");
    };
    afterPrintRef.current = cleanup;
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[340px] p-0 gap-0 overflow-hidden">
        <div className="px-4 pt-4 pb-2 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">Receipt</h2>
          {sale && (
            <p className="font-mono text-xs text-slate-400 mt-0.5">{sale.receiptNumber}</p>
          )}
        </div>

        <div className="overflow-y-auto max-h-[65vh] bg-white px-3 py-3">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading receipt…
            </div>
          )}
          {error && (
            <div className="py-10 text-center text-sm text-red-500">
              Failed to load receipt.
            </div>
          )}
          {sale && <ThermalReceipt sale={sale} amountGiven={amountGiven} />}
        </div>

        <div className="px-4 py-3 border-t border-slate-100 flex gap-2">
          <Button
            variant="outline"
            className="flex-1 gap-1.5"
            disabled={!sale}
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4" />
            Print Receipt
          </Button>
          <Button className="flex-1" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

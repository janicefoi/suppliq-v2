"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { linkInvoice } from "@/lib/actions/purchases";

interface InvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  poId: string;
  poNumber: string;
  poTotalCost: number;
  currency: string;
  existingRef?: string | null;
  existingAmount?: number | null;
  existingDate?: string | null;
}

export function InvoiceDialog({
  open,
  onClose,
  poId,
  poNumber,
  poTotalCost,
  currency,
  existingRef,
  existingAmount,
  existingDate,
}: InvoiceDialogProps) {
  const [ref, setRef] = useState(existingRef ?? "");
  const [amount, setAmount] = useState(
    existingAmount != null ? (existingAmount / 100).toFixed(2) : (poTotalCost / 100).toFixed(2)
  );
  const [date, setDate] = useState(
    existingDate ? existingDate.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    const amtNum = parseFloat(amount);
    if (!ref.trim()) { setError("Invoice reference is required."); return; }
    if (isNaN(amtNum) || amtNum <= 0) { setError("Enter a valid invoice amount."); return; }
    if (!date) { setError("Invoice date is required."); return; }

    setSaving(true);
    setError("");
    const result = await linkInvoice(poId, {
      invoiceRef: ref.trim(),
      invoiceAmount: Math.round(amtNum * 100),
      invoiceDate: date,
    });
    setSaving(false);
    if (result.success) {
      onClose();
    } else {
      setError(result.error ?? "Failed to link invoice.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            Link Supplier Invoice
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            PO {poNumber} — match the supplier invoice to this order.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">Invoice Reference *</label>
            <Input
              placeholder="e.g. INV-2026-00842"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
            />
            <p className="text-[11px] text-slate-400">The invoice number from the supplier.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">Invoice Amount ({currency}) *</label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-[11px] text-slate-400">
              PO cost total: {(poTotalCost / 100).toFixed(2)} {currency}. Enter the invoice amount to compare.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700">Invoice Date *</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : existingRef ? "Update invoice" : "Link invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

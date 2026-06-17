"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle, ArrowRight } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTransfer } from "@/lib/actions/transfers";
import { formatCurrency } from "@/lib/utils";
import type { TransferRecommendation } from "@/app/(dashboard)/insights/transfer-recommendations/page";

interface Props {
  rec: TransferRecommendation | null;
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConfirmTransferDialog({ rec, currency, onClose, onSuccess }: Props) {
  const [qty,      setQty]   = useState(0);
  const [notes,    setNotes] = useState("");
  const [loading,  setLoad]  = useState(false);
  const [error,    setError] = useState<string | null>(null);

  useEffect(() => {
    if (rec) {
      setQty(rec.transfer_qty);
      setNotes("");
      setError(null);
    }
  }, [rec]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rec) return;
    if (!qty || qty < 1) { setError("Quantity must be at least 1."); return; }
    if (qty > rec.from_stock) { setError("Cannot transfer more than available stock."); return; }

    setLoad(true);
    setError(null);
    const result = await createTransfer({
      fromBranchId: rec.from_branch_id,
      toBranchId:   rec.to_branch_id,
      notes:        notes || `AI transfer hint — ${rec.item_name}`,
      items:        [{ itemId: rec.item_id, quantity: qty }],
    });
    setLoad(false);
    if (!result.success) { setError(result.error); return; }
    onSuccess();
  }

  const capital  = rec ? formatCurrency(rec.capital_freed, currency) : "";
  const savings  = rec ? formatCurrency(rec.reorder_savings, currency) : "";

  return (
    <Dialog open={rec !== null} onOpenChange={(o) => { if (!o && !loading) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create transfer</DialogTitle>
          {rec && (
            <DialogDescription>
              {rec.item_name} · {rec.sku}
            </DialogDescription>
          )}
        </DialogHeader>

        {rec && (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">

            {/* Route */}
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <div className="flex-1 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-center">
                <p className="text-[10px] text-slate-400 mb-0.5">From</p>
                <p className="font-semibold">{rec.from_branch_name}</p>
                <p className="text-[10px] text-slate-500">{rec.from_stock} units · {rec.from_days_of_cover}d cover</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
              <div className="flex-1 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-center">
                <p className="text-[10px] text-blue-400 mb-0.5">To</p>
                <p className="font-semibold text-blue-800">{rec.to_branch_name}</p>
                <p className="text-[10px] text-blue-600">
                  {rec.to_stock} units
                  {rec.to_days_of_cover !== null ? ` · ${rec.to_days_of_cover}d cover` : " · below ROP"}
                </p>
              </div>
            </div>

            {/* Benefits */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md bg-amber-50 border border-amber-100 px-3 py-1.5 text-center">
                <p className="text-[9px] uppercase tracking-wide text-amber-600 font-semibold">Capital freed</p>
                <p className="text-sm font-bold text-amber-800 tabular-nums">{capital}</p>
              </div>
              <div className="rounded-md bg-green-50 border border-green-100 px-3 py-1.5 text-center">
                <p className="text-[9px] uppercase tracking-wide text-green-600 font-semibold">Reorder saved</p>
                <p className="text-sm font-bold text-green-800 tabular-nums">~{savings}</p>
              </div>
            </div>

            {/* Quantity */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline">
                <Label>Transfer quantity</Label>
                <span className="text-[10px] text-blue-500">suggested: {rec.transfer_qty}</span>
              </div>
              <Input
                type="number"
                min="1"
                max={rec.from_stock}
                step="1"
                value={qty}
                onChange={(e) => setQty(parseInt(e.target.value) || 0)}
                className="tabular-nums"
                autoFocus
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input
                placeholder="AI-suggested inter-branch transfer"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="gap-1.5">
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create transfer
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

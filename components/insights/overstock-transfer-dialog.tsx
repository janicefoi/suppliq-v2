"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle, ArrowRightLeft } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTransfer } from "@/lib/actions/transfers";
import type { OverstockItem } from "@/app/(dashboard)/insights/overstock/page";

interface Props {
  item: OverstockItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function OverstockTransferDialog({ item, onClose, onSuccess }: Props) {
  const suggestion = item?.transfer_suggestion ?? null;
  const open = item !== null && suggestion !== null;

  const [qty, setQty]           = useState(0);
  const [notes, setNotes]       = useState("");
  const [submitting, setSub]    = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (suggestion) {
      setQty(suggestion.transfer_qty);
      setNotes("");
      setError(null);
    }
  }, [suggestion]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item || !suggestion) return;
    if (!qty || qty < 1) { setError("Quantity must be at least 1."); return; }
    if (qty > item.current_stock) { setError("Cannot transfer more than available stock."); return; }

    setSub(true);
    setError(null);
    const result = await createTransfer({
      fromBranchId: item.branch_id,
      toBranchId:   suggestion.to_branch_id,
      notes:        notes || `AI-suggested overstock transfer — ${item.item_name}`,
      items:        [{ itemId: item.item_id, quantity: qty }],
    });
    setSub(false);
    if (!result.success) { setError(result.error); return; }
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !submitting) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-blue-500" />
            Inter-branch transfer
          </DialogTitle>
          {item && (
            <DialogDescription>
              {item.item_name} · {item.sku}
            </DialogDescription>
          )}
        </DialogHeader>

        {item && suggestion && (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Route strip */}
            <div className="rounded-md bg-blue-50 border border-blue-100 px-3 py-2.5 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">From</span>
                <span className="font-semibold text-slate-800">{item.branch_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">To</span>
                <span className="font-semibold text-slate-800">{suggestion.to_branch_name}</span>
              </div>
              <div className="border-t border-blue-100 pt-1.5 flex justify-between">
                <span className="text-slate-500">Available at source</span>
                <span className="font-semibold text-slate-800">{item.current_stock} units</span>
              </div>
              {suggestion.dest_days_of_cover !== null && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Days of cover at destination</span>
                  <span className="font-semibold text-red-600">{suggestion.dest_days_of_cover}d</span>
                </div>
              )}
            </div>

            {/* Quantity */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline">
                <Label>Transfer quantity</Label>
                <span className="text-[10px] text-blue-500">suggested: {suggestion.transfer_qty}</span>
              </div>
              <Input
                type="number"
                min="1"
                max={item.current_stock}
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
                placeholder="AI-suggested overstock transfer"
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
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="gap-1.5">
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create transfer
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

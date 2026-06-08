"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle, PackagePlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { stockIn } from "@/lib/actions/inventory";

interface StockInDialogProps {
  open: boolean;
  onClose: () => void;
  item: { id: string; name: string; sku: string; stockQty: number } | null;
  onSuccess: () => void;
  branches?: { id: string; name: string }[];
  selectedBranchId?: string | null;
}

export function StockInDialog({ open, onClose, item, onSuccess, branches = [], selectedBranchId }: StockInDialogProps) {
  const isAdmin = branches.length > 0;
  const [qty, setQty] = useState("");
  const [branchId, setBranchId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQty("");
      setError(null);
      // Pre-select the branch the admin is currently viewing (if a specific one is selected)
      setBranchId(selectedBranchId ?? "");
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open, selectedBranchId]);

  const parsedQty = parseInt(qty);
  const newStock = item && parsedQty > 0 ? item.stockQty + parsedQty : null;

  async function handleSubmit() {
    if (!item) return;
    if (!parsedQty || parsedQty <= 0 || !Number.isInteger(parsedQty)) {
      setError("Please enter a valid positive whole number.");
      return;
    }
    if (isAdmin && !branchId) {
      setError("Please select a branch to stock into.");
      return;
    }

    setIsLoading(true);
    setError(null);
    const result = await stockIn(item.id, parsedQty, isAdmin ? branchId : undefined);
    setIsLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !isLoading) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="h-4 w-4 text-green-600" />
            Stock In
          </DialogTitle>
          {item && (
            <DialogDescription>
              {item.name}{" "}
              <span className="font-mono text-slate-500">{item.sku}</span>
            </DialogDescription>
          )}
        </DialogHeader>

        {item && (
          <div className="space-y-4 pt-1">
            {/* Branch selector (admin only) */}
            {isAdmin && (
              <div className="space-y-1.5">
                <Label htmlFor="stock-in-branch">Branch</Label>
                <select
                  id="stock-in-branch"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="">— Select branch —</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Current stock */}
            <div className="flex items-center justify-between rounded-md bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm">
              <span className="text-slate-500">Current stock</span>
              <span className="font-bold tabular-nums text-slate-800">{item.stockQty} units</span>
            </div>

            {/* Quantity input */}
            <div className="space-y-1.5">
              <Label htmlFor="stock-in-qty">Quantity to add</Label>
              <Input
                id="stock-in-qty"
                ref={inputRef}
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 50"
                value={qty}
                onChange={(e) => { setQty(e.target.value); setError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                className="tabular-nums"
              />
            </div>

            {/* New stock preview */}
            {newStock !== null && (
              <div className="flex items-center justify-between rounded-md bg-green-50 border border-green-200 px-3 py-2.5 text-sm">
                <span className="text-green-700">Stock after</span>
                <span className="font-bold tabular-nums text-green-700">{newStock} units</span>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isLoading || !qty || parsedQty <= 0}
                className="gap-1.5 bg-green-600 hover:bg-green-700"
              >
                {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Add stock
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

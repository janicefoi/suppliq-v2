"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle, SlidersHorizontal, TrendingUp, TrendingDown, Minus } from "lucide-react";
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
import { adjustStock, getItemBranchStocks, type ItemBranchStock } from "@/lib/actions/inventory";

const REASONS = [
  "Stocktake / count correction",
  "Damage / expiry",
  "Theft / loss",
  "Found / recovered",
  "Opening balance",
  "Other",
];

interface StockAdjustDialogProps {
  open: boolean;
  onClose: () => void;
  item: { id: string; name: string; sku: string } | null;
  branches: { id: string; name: string }[];
  selectedBranchId?: string | null;
  onSuccess: () => void;
}

export function StockAdjustDialog({
  open,
  onClose,
  item,
  branches,
  selectedBranchId,
  onSuccess,
}: StockAdjustDialogProps) {
  const [branchId, setBranchId] = useState<string>("");
  const [branchStocks, setBranchStocks] = useState<ItemBranchStock[]>([]);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [physicalCount, setPhysicalCount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !item) return;
    setPhysicalCount("");
    setReason("");
    setError(null);
    setSubmitting(false);
    const initial = selectedBranchId ?? (branches.length === 1 ? branches[0].id : "");
    setBranchId(initial);
    setLoadingStocks(true);
    getItemBranchStocks(item.id).then((stocks) => {
      setBranchStocks(stocks);
      setLoadingStocks(false);
      setTimeout(() => inputRef.current?.focus(), 40);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const currentBranchStock = branchStocks.find((bs) => bs.branchId === branchId);
  const currentQty = currentBranchStock?.stockQty ?? null;

  const parsedCount = physicalCount === "" ? null : parseInt(physicalCount, 10);
  const isValidCount = parsedCount !== null && Number.isInteger(parsedCount) && parsedCount >= 0;
  const delta = isValidCount && currentQty !== null ? parsedCount - currentQty : null;

  async function handleSubmit() {
    if (!item || !branchId) {
      setError("Please select a branch.");
      return;
    }
    if (!isValidCount || parsedCount === null) {
      setError("Please enter a valid non-negative whole number.");
      return;
    }
    if (!reason) {
      setError("Please select a reason for the adjustment.");
      return;
    }

    setSubmitting(true);
    setError(null);
    const result = await adjustStock(item.id, branchId, parsedCount, reason);
    setSubmitting(false);

    if (!result.success) {
      setError(result.error);
      return;
    }
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !submitting) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-blue-600" />
            Adjust Stock
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
            {/* Branch selector */}
            {branches.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="adj-branch">Branch</Label>
                <select
                  id="adj-branch"
                  value={branchId}
                  onChange={(e) => { setBranchId(e.target.value); setError(null); }}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="">- Select branch -</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Current stock */}
            <div className="flex items-center justify-between rounded-md bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm">
              <span className="text-slate-500">System stock</span>
              {loadingStocks ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
              ) : currentQty !== null ? (
                <span className="font-bold tabular-nums text-slate-800">{currentQty} units</span>
              ) : (
                <span className="text-slate-400 text-xs">select a branch</span>
              )}
            </div>

            {/* Physical count input */}
            <div className="space-y-1.5">
              <Label htmlFor="adj-count">Physical count (what you actually counted)</Label>
              <Input
                id="adj-count"
                ref={inputRef}
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 48"
                value={physicalCount}
                onChange={(e) => { setPhysicalCount(e.target.value); setError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                className="tabular-nums"
                disabled={!branchId}
              />
            </div>

            {/* Delta preview */}
            {delta !== null && (
              <div className={`flex items-center justify-between rounded-md px-3 py-2.5 text-sm border ${
                delta > 0
                  ? "bg-green-50 border-green-200"
                  : delta < 0
                  ? "bg-red-50 border-red-200"
                  : "bg-slate-50 border-slate-200"
              }`}>
                <span className={delta > 0 ? "text-green-700" : delta < 0 ? "text-red-700" : "text-slate-500"}>
                  {delta > 0 ? "Gain" : delta < 0 ? "Loss" : "No change"}
                </span>
                <div className="flex items-center gap-1.5">
                  {delta > 0 && <TrendingUp className="h-3.5 w-3.5 text-green-600" />}
                  {delta < 0 && <TrendingDown className="h-3.5 w-3.5 text-red-600" />}
                  {delta === 0 && <Minus className="h-3.5 w-3.5 text-slate-400" />}
                  <span className={`font-bold tabular-nums ${
                    delta > 0 ? "text-green-700" : delta < 0 ? "text-red-700" : "text-slate-500"
                  }`}>
                    {delta > 0 ? `+${delta}` : delta} units
                  </span>
                </div>
              </div>
            )}

            {/* Reason */}
            <div className="space-y-1.5">
              <Label htmlFor="adj-reason">Reason</Label>
              <select
                id="adj-reason"
                value={reason}
                onChange={(e) => { setReason(e.target.value); setError(null); }}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="">- Select reason -</option>
                {REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !branchId || !isValidCount || !reason}
                className="gap-1.5"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Apply adjustment
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

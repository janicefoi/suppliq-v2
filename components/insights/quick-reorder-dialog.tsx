"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertCircle, ShoppingBag } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { recordPurchaseOrder } from "@/lib/actions/suppliers";
import { formatCurrency } from "@/lib/utils";
import type { ReorderRecommendation } from "@/app/(dashboard)/insights/reorder/page";
import type { SupplierRow } from "@/lib/actions/suppliers";

interface Props {
  rec: ReorderRecommendation | null;
  suppliers: Pick<SupplierRow, "id" | "name">[];
  branches: { id: string; name: string }[];
  currency: string;
  isAdmin: boolean;
  defaultBranchId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function QuickReorderDialog({
  rec, suppliers, branches, currency, isAdmin, defaultBranchId, onClose, onSuccess,
}: Props) {
  const open = rec !== null;

  const [supplierId, setSupplierId]   = useState("");
  const [branchId,   setBranchId]     = useState<string>(defaultBranchId ?? "");
  const [qty,        setQty]          = useState(0);
  const [costPrice,  setCostPrice]    = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [error,      setError]        = useState<string | null>(null);

  // Reset fields whenever a new recommendation is opened
  useEffect(() => {
    if (rec) {
      setQty(rec.suggested_order_qty);
      setBranchId(rec.branch_id ?? defaultBranchId ?? "");
      setSupplierId("");
      setCostPrice("");
      setError(null);
    }
  }, [rec, defaultBranchId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rec) return;
    if (!supplierId) { setError("Please select a supplier."); return; }
    if (!qty || qty < 1) { setError("Quantity must be at least 1."); return; }
    const cost = parseFloat(costPrice);
    if (isNaN(cost) || cost <= 0) { setError("Enter a valid cost price."); return; }

    setSubmitting(true);
    setError(null);
    const result = await recordPurchaseOrder({
      supplierId,
      branchId: branchId || null,
      items: [{ itemId: rec.item_id, quantity: qty, costPrice: cost }],
    });
    setSubmitting(false);

    if (!result.success) { setError(result.error); return; }
    onSuccess();
  }

  const totalCost = qty * parseFloat(costPrice || "0");

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !submitting) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-blue-500" />
            Quick reorder
          </DialogTitle>
          {rec && (
            <DialogDescription>
              {rec.item_name} · {rec.sku}
            </DialogDescription>
          )}
        </DialogHeader>

        {rec && (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">

            {/* Context strip */}
            <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2 grid grid-cols-3 gap-3 text-center text-xs">
              <div>
                <p className="text-slate-400">Current stock</p>
                <p className="font-bold text-slate-800 text-sm">{rec.current_stock}</p>
              </div>
              <div>
                <p className="text-slate-400">Days left</p>
                <p className={`font-bold text-sm ${
                  rec.estimated_days_until_stockout === null ? "text-slate-400" :
                  rec.estimated_days_until_stockout <= 3 ? "text-red-600" :
                  rec.estimated_days_until_stockout <= 7 ? "text-amber-600" : "text-slate-700"
                }`}>
                  {rec.estimated_days_until_stockout !== null
                    ? `~${rec.estimated_days_until_stockout}d`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-slate-400">ROP threshold</p>
                <p className="font-bold text-slate-800 text-sm">{rec.reorder_point}</p>
              </div>
            </div>

            {/* Branch (admin only or if pre-filled) */}
            {isAdmin && branches.length > 0 && (
              <div className="space-y-1.5">
                <Label>Branch *</Label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">- Select branch -</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Supplier */}
            <div className="space-y-1.5">
              <Label>Supplier *</Label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">- Select supplier -</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Quantity */}
              <div className="space-y-1.5">
                <Label>
                  Quantity
                  <span className="ml-1.5 text-[10px] font-normal text-blue-500">
                    suggested: {rec.suggested_order_qty}
                  </span>
                </Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={qty}
                  onChange={(e) => setQty(parseInt(e.target.value) || 0)}
                  className="tabular-nums"
                />
              </div>

              {/* Cost price */}
              <div className="space-y-1.5">
                <Label>Cost per unit *</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  className="tabular-nums"
                />
              </div>
            </div>

            {/* Total */}
            {totalCost > 0 && (
              <>
                <Separator />
                <div className="flex justify-between items-center px-1 text-sm">
                  <span className="text-slate-500">Total cost</span>
                  <span className="font-bold tabular-nums text-slate-800">
                    {formatCurrency(totalCost, currency)}
                  </span>
                </div>
              </>
            )}

            {/* Claude reasoning */}
            {rec.reasoning && (
              <details className="group">
                <summary className="cursor-pointer text-[11px] text-blue-600 hover:text-blue-800 select-none list-none flex items-center gap-1">
                  <span className="group-open:hidden">Show AI reasoning</span>
                  <span className="hidden group-open:inline">Hide AI reasoning</span>
                </summary>
                <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed border-l-2 border-blue-100 pl-3">
                  {rec.reasoning}
                </p>
              </details>
            )}

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
              <Button type="submit" disabled={submitting} className="gap-1.5">
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Record purchase order
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

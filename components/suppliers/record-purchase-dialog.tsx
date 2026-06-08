"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, AlertCircle, Package, AlertTriangle, Plus, Trash2 } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { recordPurchaseOrder } from "@/lib/actions/suppliers";
import { PurchaseOrderSchema, type PurchaseOrderInput } from "@/lib/validations/suppliers";
import type { SupplierDetail } from "@/lib/actions/suppliers";

type SupplierItem = SupplierDetail["items"][number];

function fmtKES(n: number) {
  return `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface RecordPurchaseDialogProps {
  open: boolean;
  onClose: () => void;
  supplierId: string;
  supplierName: string;
  items: SupplierItem[];
  onSuccess: () => void;
  isAdmin?: boolean;
  branches?: { id: string; name: string }[];
  defaultBranchId?: string | null;
}

const emptyLine = { itemId: "", quantity: undefined as unknown as number, costPrice: undefined as unknown as number };

export function RecordPurchaseDialog({
  open,
  onClose,
  supplierId,
  supplierName,
  items,
  onSuccess,
  isAdmin = false,
  branches = [],
  defaultBranchId,
}: RecordPurchaseDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const activeItems = items.filter((i) => i.isActive);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseOrderInput>({
    resolver: zodResolver(PurchaseOrderSchema),
    defaultValues: {
      supplierId,
      branchId: defaultBranchId ?? null,
      items: [{ ...emptyLine }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const watchedItems = watch("items");

  useEffect(() => {
    if (open) {
      reset({
        supplierId,
        branchId: defaultBranchId ?? null,
        items: [{ ...emptyLine }],
      });
      setServerError(null);
    }
  }, [open, supplierId, defaultBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(data: PurchaseOrderInput) {
    setServerError(null);
    const result = await recordPurchaseOrder(data);
    if (!result.success) {
      setServerError(result.error);
      return;
    }
    onSuccess();
  }

  // Grand total across all rows
  const grandTotal = watchedItems?.reduce((sum, line) => {
    return sum + (Number(line.quantity) || 0) * (Number(line.costPrice) || 0);
  }, 0) ?? 0;

  const itemsError = errors.items?.root?.message ?? (Array.isArray(errors.items) ? undefined : (errors.items as { message?: string })?.message);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !isSubmitting) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record stock purchase</DialogTitle>
          <DialogDescription>from {supplierName}</DialogDescription>
        </DialogHeader>

        {activeItems.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-500">
            <Package className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            This supplier has no active items linked to them yet.
            <br />
            <span className="text-xs text-slate-400 mt-1 block">
              Link items from Inventory → Edit item → Supplier.
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
            <input type="hidden" {...register("supplierId")} />

            {/* Branch selector (admin only) */}
            {isAdmin && branches.length > 0 && (
              <div className="space-y-1.5">
                <Label>Branch *</Label>
                <Controller
                  control={control}
                  name="branchId"
                  render={({ field }) => (
                    <select
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="">— Select branch —</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  )}
                />
              </div>
            )}

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_90px_110px_32px] gap-2 px-1">
              <p className="text-xs font-medium text-slate-500">Item</p>
              <p className="text-xs font-medium text-slate-500">Qty</p>
              <p className="text-xs font-medium text-slate-500">Cost / unit</p>
              <span />
            </div>

            {/* Line items */}
            <div className="space-y-2">
              {fields.map((field, idx) => {
                const line = watchedItems?.[idx];
                const selectedItem = activeItems.find((i) => i.id === line?.itemId);
                const retailPrice = selectedItem ? Number(selectedItem.retailPrice) : 0;
                const lineCost = (Number(line?.quantity) || 0) * (Number(line?.costPrice) || 0);
                const costExceedsRetail = Number(line?.costPrice) > 0 && retailPrice > 0 && Number(line?.costPrice) > retailPrice;
                const lineErrors = Array.isArray(errors.items) ? errors.items[idx] : undefined;

                return (
                  <div key={field.id} className="space-y-1">
                    <div className="grid grid-cols-[1fr_90px_110px_32px] gap-2 items-start">
                      {/* Item select */}
                      <div>
                        <select
                          {...register(`items.${idx}.itemId`)}
                          className="w-full h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="">Select item…</option>
                          {activeItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} ({item.sku})
                            </option>
                          ))}
                        </select>
                        {lineErrors?.itemId && (
                          <p className="text-xs text-red-500 mt-0.5">{lineErrors.itemId.message}</p>
                        )}
                      </div>

                      {/* Quantity */}
                      <div>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="0"
                          {...register(`items.${idx}.quantity`, { valueAsNumber: true })}
                          className="tabular-nums h-9"
                        />
                        {lineErrors?.quantity && (
                          <p className="text-xs text-red-500 mt-0.5">{lineErrors.quantity.message}</p>
                        )}
                      </div>

                      {/* Cost price */}
                      <div>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="0.00"
                          {...register(`items.${idx}.costPrice`, { valueAsNumber: true })}
                          className="tabular-nums h-9"
                        />
                        {lineErrors?.costPrice && (
                          <p className="text-xs text-red-500 mt-0.5">{lineErrors.costPrice.message}</p>
                        )}
                      </div>

                      {/* Remove row */}
                      <button
                        type="button"
                        onClick={() => remove(idx)}
                        disabled={fields.length === 1}
                        className="h-9 w-8 flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Remove line"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Per-row info: stock + line total */}
                    {selectedItem && (
                      <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
                        <span>
                          Stock: <span className="font-medium text-slate-500">{selectedItem.stockQty}</span>
                          {" · "}Retail: <span className="font-medium text-slate-500">{fmtKES(retailPrice)}</span>
                        </span>
                        {lineCost > 0 && (
                          <span className="font-medium text-slate-600">{fmtKES(lineCost)}</span>
                        )}
                      </div>
                    )}

                    {/* Cost > retail warning */}
                    {costExceedsRetail && (
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-600 px-1">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        Cost exceeds retail price — item would be sold at a loss.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add line button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-1.5 border-dashed text-slate-500 hover:text-slate-800"
              onClick={() => append({ ...emptyLine })}
            >
              <Plus className="h-3.5 w-3.5" />
              Add another item
            </Button>

            {itemsError && (
              <p className="text-xs text-red-500">{itemsError}</p>
            )}

            {/* Grand total */}
            {grandTotal > 0 && (
              <>
                <Separator />
                <div className="flex justify-between items-center px-1">
                  <span className="text-sm text-slate-500">
                    Total purchase cost
                    <span className="ml-1.5 text-xs text-slate-400">({fields.length} line{fields.length !== 1 ? "s" : ""})</span>
                  </span>
                  <span className="text-base font-bold tabular-nums text-slate-800">{fmtKES(grandTotal)}</span>
                </div>
              </>
            )}

            {serverError && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {serverError}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-1">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-1.5">
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Record purchase
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

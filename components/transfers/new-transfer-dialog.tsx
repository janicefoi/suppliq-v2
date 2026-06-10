"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Loader2, AlertCircle, ArrowRight } from "lucide-react";
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
import { createTransfer, getItemsForBranch } from "@/lib/actions/transfers";
import type { TransferInput, BranchItem } from "@/lib/actions/transfers";

// Client-side schema mirrors server schema
const TransferSchema = z.object({
  fromBranchId: z.string().min(1, "Select a source branch"),
  toBranchId: z.string().min(1, "Select a destination branch"),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1, "Select an item"),
        quantity: z.number().int().positive("Must be at least 1"),
      })
    )
    .min(1, "Add at least one item"),
}).refine((d) => d.fromBranchId !== d.toBranchId, {
  message: "Source and destination branches must be different",
  path: ["toBranchId"],
});

type Branch = { id: string; name: string };

interface NewTransferDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  branches: Branch[];
  defaultFromBranchId?: string | null;
}

const emptyLine = { itemId: "", quantity: 1 };

export function NewTransferDialog({
  open,
  onClose,
  onSuccess,
  branches,
  defaultFromBranchId,
}: NewTransferDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [availableItems, setAvailableItems] = useState<BranchItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TransferInput>({
    resolver: zodResolver(TransferSchema),
    defaultValues: {
      fromBranchId: defaultFromBranchId ?? "",
      toBranchId: "",
      notes: "",
      items: [{ ...emptyLine }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedFromBranch = watch("fromBranchId");
  const watchedItems = watch("items");

  const loadItems = useCallback(async (branchId: string) => {
    if (!branchId) { setAvailableItems([]); return; }
    setLoadingItems(true);
    const items = await getItemsForBranch(branchId);
    setAvailableItems(items);
    setLoadingItems(false);
  }, []);

  useEffect(() => {
    if (open) {
      reset({
        fromBranchId: defaultFromBranchId ?? "",
        toBranchId: "",
        notes: "",
        items: [{ ...emptyLine }],
      });
      setServerError(null);
      if (defaultFromBranchId) loadItems(defaultFromBranchId);
      else setAvailableItems([]);
    }
  }, [open, defaultFromBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    // Reset item lines whenever from-branch changes
    setValue("items", [{ ...emptyLine }]);
    loadItems(watchedFromBranch);
  }, [watchedFromBranch]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(data: TransferInput) {
    setServerError(null);
    const result = await createTransfer(data);
    if (!result.success) {
      setServerError(result.error);
      return;
    }
    onSuccess();
  }

  const totalQty = watchedItems?.reduce((s, l) => s + (Number(l.quantity) || 0), 0) ?? 0;
  const toBranchError = (errors as { toBranchId?: { message?: string } }).toBranchId?.message;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !isSubmitting) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New stock transfer</DialogTitle>
          <DialogDescription>Move stock between branches. Stock is transferred immediately.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-1">
          {/* From / To branches */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
            <div className="space-y-1.5">
              <Label>From branch *</Label>
              <select
                {...register("fromBranchId")}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">- Select branch -</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              {errors.fromBranchId && (
                <p className="text-xs text-red-500">{errors.fromBranchId.message}</p>
              )}
            </div>

            <ArrowRight className="h-4 w-4 text-slate-400 mb-2.5 shrink-0" />

            <div className="space-y-1.5">
              <Label>To branch *</Label>
              <select
                {...register("toBranchId")}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">- Select branch -</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              {toBranchError && (
                <p className="text-xs text-red-500">{toBranchError}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Items section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Items to transfer *</Label>
              {loadingItems && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading stock…
                </span>
              )}
              {!loadingItems && watchedFromBranch && availableItems.length === 0 && (
                <span className="text-xs text-amber-600">No stock at this branch</span>
              )}
              {!loadingItems && availableItems.length > 0 && (
                <span className="text-xs text-slate-400">{availableItems.length} item{availableItems.length !== 1 ? "s" : ""} available</span>
              )}
            </div>

            {!watchedFromBranch ? (
              <p className="text-sm text-slate-400 py-2">Select a source branch to see available items.</p>
            ) : (
              <>
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_100px_32px] gap-2 px-1">
                  <p className="text-xs font-medium text-slate-500">Item</p>
                  <p className="text-xs font-medium text-slate-500">Quantity</p>
                  <span />
                </div>

                <div className="space-y-2">
                  {fields.map((field, idx) => {
                    const lineErrors = Array.isArray(errors.items) ? errors.items[idx] : undefined;
                    const selectedItem = availableItems.find((i) => i.id === watchedItems?.[idx]?.itemId);

                    return (
                      <div key={field.id} className="space-y-1">
                        <div className="grid grid-cols-[1fr_100px_32px] gap-2 items-start">
                          <div>
                            <Controller
                              control={control}
                              name={`items.${idx}.itemId`}
                              render={({ field: f }) => (
                                <select
                                  value={f.value}
                                  onChange={f.onChange}
                                  disabled={availableItems.length === 0}
                                  className="w-full h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                                >
                                  <option value="">Select item…</option>
                                  {availableItems.map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.name} ({item.sku})
                                    </option>
                                  ))}
                                </select>
                              )}
                            />
                            {lineErrors?.itemId && (
                              <p className="text-xs text-red-500 mt-0.5">{lineErrors.itemId.message}</p>
                            )}
                          </div>

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

                          <button
                            type="button"
                            onClick={() => remove(idx)}
                            disabled={fields.length === 1}
                            className="h-9 w-8 flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {selectedItem && (
                          <div className="flex items-center gap-3 px-1 text-[11px] text-slate-400">
                            <span>
                              Available: <span className="font-medium text-slate-500">{selectedItem.stockQty}</span>
                            </span>
                            <span>
                              Category: <span className="font-medium text-slate-500">{selectedItem.category || "-"}</span>
                            </span>
                            {(Number(watchedItems?.[idx]?.quantity) || 0) > selectedItem.stockQty && (
                              <span className="text-red-500 font-medium">Exceeds available stock</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 border-dashed text-slate-500 hover:text-slate-800"
                  onClick={() => append({ ...emptyLine })}
                  disabled={availableItems.length === 0}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add another item
                </Button>

                {errors.items && !Array.isArray(errors.items) && (
                  <p className="text-xs text-red-500">
                    {(errors.items as { message?: string }).message}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes <span className="text-slate-400 font-normal">(optional)</span></Label>
            <Input
              {...register("notes")}
              placeholder="e.g. Weekly restock for north branch"
              className="text-sm"
            />
          </div>

          {/* Summary */}
          {totalQty > 0 && (
            <>
              <Separator />
              <div className="flex justify-between items-center px-1">
                <span className="text-sm text-slate-500">
                  Total units
                  <span className="ml-1.5 text-xs text-slate-400">
                    ({fields.length} line{fields.length !== 1 ? "s" : ""})
                  </span>
                </span>
                <span className="text-base font-bold tabular-nums text-slate-800">{totalQty.toLocaleString()}</span>
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
              Record transfer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

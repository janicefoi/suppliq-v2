"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Wand2, Loader2 } from "lucide-react";
import { ItemSchema, type ItemFormValues } from "@/lib/validations/inventory";
import { generateSku } from "@/lib/actions/inventory";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface ItemFormProps {
  defaultValues?: Partial<ItemFormValues>;
  categories: Category[];
  suppliers: Supplier[];
  onSubmit: (data: ItemFormValues) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  onCancel: () => void;
  submitLabel?: string;
  isEditing?: boolean;
  isAdmin?: boolean;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-500 mt-1">{message}</p>;
}

const selectClass = cn(
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1",
  "text-sm shadow-sm transition-colors focus-visible:outline-none",
  "focus-visible:ring-1 focus-visible:ring-ring"
);

const EMPTY_DEFAULTS: Partial<ItemFormValues> = {
  stockQty: 0,
  lowStockThreshold: 5,
  specialPrice: null,
  supplierId: null,
};

export function ItemForm({
  defaultValues,
  categories,
  suppliers,
  onSubmit,
  isLoading,
  error,
  onCancel,
  submitLabel = "Save item",
  isEditing = false,
  isAdmin = false,
}: ItemFormProps) {
  const [isGeneratingSku, setIsGeneratingSku] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(ItemSchema),
    defaultValues: { ...EMPTY_DEFAULTS, ...defaultValues },
  });

  const categoryValue = watch("category");
  const retailPriceValue = watch("retailPrice");
  const wholesalePriceValue = watch("wholesalePrice");
  const specialPriceValue = watch("specialPrice");

  const wholesaleExceedsRetail =
    Number(wholesalePriceValue) > 0 &&
    Number(retailPriceValue) > 0 &&
    Number(wholesalePriceValue) > Number(retailPriceValue);

  const specialExceedsRetail =
    specialPriceValue !== null &&
    specialPriceValue !== undefined &&
    String(specialPriceValue) !== "" &&
    Number(specialPriceValue) > 0 &&
    Number(retailPriceValue) > 0 &&
    Number(specialPriceValue) >= Number(retailPriceValue);

  async function handleAutoSku() {
    if (!categoryValue) return;
    setIsGeneratingSku(true);
    try {
      const sku = await generateSku(categoryValue);
      setValue("sku", sku, { shouldValidate: true });
    } finally {
      setIsGeneratingSku(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

      {/* Row 1 — SKU + Name */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="sku">
            SKU *
            {isEditing && <span className="ml-1.5 text-[10px] text-slate-400 font-normal normal-case">(read-only)</span>}
          </Label>
          {isEditing ? (
            <div className="mt-1.5 flex h-9 w-full items-center rounded-md border border-slate-200 bg-slate-50 px-3 font-mono text-sm text-slate-500 select-none">
              {String(watch("sku") ?? "")}
            </div>
          ) : (
            <>
              <div className="flex gap-1.5 mt-1.5">
                <Input id="sku" placeholder="e.g. ENG-001" {...register("sku")} />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 h-9 w-9"
                  onClick={handleAutoSku}
                  disabled={isGeneratingSku || !categoryValue}
                  title={categoryValue ? "Auto-generate SKU from category" : "Select a category first"}
                >
                  {isGeneratingSku ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Pick a category first, then click the wand to auto-fill</p>
              <FieldError message={errors.sku?.message} />
            </>
          )}
        </div>
        <div>
          <Label htmlFor="name">
            Name *
            {isEditing && <span className="ml-1.5 text-[10px] text-slate-400 font-normal normal-case">(read-only)</span>}
          </Label>
          {isEditing ? (
            <div className="mt-1.5 flex h-9 w-full items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 select-none truncate">
              {String(watch("name") ?? "")}
            </div>
          ) : (
            <>
              <Input id="name" placeholder="Item name" className="mt-1.5" {...register("name")} />
              <FieldError message={errors.name?.message} />
            </>
          )}
        </div>
      </div>

      {/* Row 2 — Category + Description */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="category">
            Category *
            {isEditing && <span className="ml-1.5 text-[10px] text-slate-400 font-normal normal-case">(read-only)</span>}
          </Label>
          {isEditing ? (
            <div className="mt-1.5 flex h-9 w-full items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 select-none">
              {String(watch("category") ?? "")}
            </div>
          ) : (
            <>
              <select id="category" className={cn(selectClass, "mt-1.5")} {...register("category")}>
                <option value="">— Select category —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              <FieldError message={errors.category?.message} />
            </>
          )}
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Optional description"
            className="mt-1.5 resize-none h-9"
            {...register("description")}
          />
          <FieldError message={errors.description?.message} />
        </div>
      </div>

      {/* Row 3 — Prices */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="retailPrice">Retail Price (KES) *</Label>
          <Input
            id="retailPrice"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            className="mt-1.5"
            {...register("retailPrice")}
          />
          <FieldError message={errors.retailPrice?.message} />
        </div>
        <div>
          <Label htmlFor="wholesalePrice">Wholesale Price (KES) *</Label>
          <Input
            id="wholesalePrice"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            className="mt-1.5"
            {...register("wholesalePrice")}
          />
          {wholesaleExceedsRetail && !errors.wholesalePrice && (
            <p className="text-xs text-amber-600 mt-1">
              Wholesale is higher than retail — is this intentional?
            </p>
          )}
          <FieldError message={errors.wholesalePrice?.message} />
        </div>
        <div>
          <Label htmlFor="specialPrice">Special Price (KES)</Label>
          <Input
            id="specialPrice"
            type="number"
            step="0.01"
            min="0"
            placeholder="Leave blank if N/A"
            className="mt-1.5"
            {...register("specialPrice")}
          />
          <p className="text-[11px] text-slate-400 mt-1">Leave blank if not applicable</p>
          {specialExceedsRetail && !errors.specialPrice && (
            <p className="text-xs text-amber-600 mt-1">
              Special price must be less than retail price
            </p>
          )}
          <FieldError message={errors.specialPrice?.message} />
        </div>
      </div>

      {/* Row 4 — Stock + Threshold + Supplier */}
      <div className={`grid gap-4 ${isEditing || isAdmin ? "grid-cols-2" : "grid-cols-3"}`}>
        {!isEditing && !isAdmin && (
          <div>
            <Label htmlFor="stockQty">Initial Stock Quantity</Label>
            <Input
              id="stockQty"
              type="number"
              min="0"
              step="1"
              className="mt-1.5"
              {...register("stockQty")}
            />
            <FieldError message={errors.stockQty?.message} />
          </div>
        )}
        {!isEditing && isAdmin && (
          <div className="col-span-2 rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
            Item will be added with 0 stock across all branches. Use the <strong>Stock In</strong> button on each branch to add quantities after saving.
          </div>
        )}
        <div>
          <Label htmlFor="lowStockThreshold">Low Stock Alert At *</Label>
          <Input
            id="lowStockThreshold"
            type="number"
            min="0"
            step="1"
            className="mt-1.5"
            {...register("lowStockThreshold")}
          />
          <FieldError message={errors.lowStockThreshold?.message} />
        </div>
        <div>
          <Label htmlFor="supplierId">Supplier</Label>
          <select
            id="supplierId"
            className={cn(selectClass, "mt-1.5")}
            {...register("supplierId")}
          >
            <option value="">— None —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <FieldError message={errors.supplierId?.message} />
        </div>
      </div>

      {/* Server error */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              Saving…
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
}

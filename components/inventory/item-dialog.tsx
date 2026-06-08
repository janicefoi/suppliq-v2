"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ItemForm } from "@/components/inventory/item-form";
import { createItem, updateItem } from "@/lib/actions/inventory";
import type { ItemFormValues } from "@/lib/validations/inventory";

export type DialogItem = {
  id: string;
  sku: string;
  name: string;
  category: string;
  description: string | null;
  retailPrice: string;
  wholesalePrice: string;
  specialPrice: string | null;
  stockQty: number;
  lowStockThreshold: number;
  supplierId: string | null;
};

interface Category {
  id: string;
  name: string;
}

interface ItemDialogProps {
  open: boolean;
  onClose: () => void;
  item: DialogItem | null;
  suppliers: { id: string; name: string }[];
  categories: Category[];
  onSuccess: () => void;
  isAdmin?: boolean;
}

export function ItemDialog({
  open,
  onClose,
  item,
  suppliers,
  categories,
  onSuccess,
  isAdmin = false,
}: ItemDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = item !== null;

  async function handleSubmit(data: ItemFormValues) {
    setIsLoading(true);
    setError(null);
    const result = isEditing
      ? await updateItem(item.id, data)
      : await createItem(data);
    setIsLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onSuccess();
  }

  const defaultValues: Partial<ItemFormValues> | undefined = item
    ? {
        sku: item.sku,
        name: item.name,
        category: item.category,
        description: item.description ?? "",
        retailPrice: Number(item.retailPrice),
        wholesalePrice: Number(item.wholesalePrice),
        specialPrice: item.specialPrice !== null ? Number(item.specialPrice) : null,
        stockQty: item.stockQty,
        lowStockThreshold: item.lowStockThreshold,
        supplierId: item.supplierId ?? "",
      }
    : undefined;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !isLoading) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit item" : "Add new item"}</DialogTitle>
          {isEditing && (
            <DialogDescription>
              {item.name} &mdash; <span className="font-mono">{item.sku}</span>
            </DialogDescription>
          )}
        </DialogHeader>

        <ItemForm
          defaultValues={defaultValues}
          categories={categories}
          suppliers={suppliers}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          error={error}
          onCancel={onClose}
          submitLabel={isEditing ? "Save changes" : "Create item"}
          isEditing={isEditing}
          isAdmin={isAdmin}
        />
      </DialogContent>
    </Dialog>
  );
}

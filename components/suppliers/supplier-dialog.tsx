"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createSupplier, updateSupplier } from "@/lib/actions/suppliers";
import { SupplierSchema, type SupplierInput } from "@/lib/validations/suppliers";
import type { SupplierRow } from "@/lib/actions/suppliers";

interface SupplierDialogProps {
  open: boolean;
  onClose: () => void;
  supplier: SupplierRow | null;
  onSuccess: () => void;
}

export function SupplierDialog({ open, onClose, supplier, onSuccess }: SupplierDialogProps) {
  const isEditing = supplier !== null;
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupplierInput>({
    resolver: zodResolver(SupplierSchema),
    defaultValues: { name: "", phone: "", email: "", address: "", notes: "" },
  });

  useEffect(() => {
    if (open) {
      reset(
        supplier
          ? {
              name: supplier.name,
              phone: supplier.phone,
              email: supplier.email ?? "",
              address: supplier.address ?? "",
              notes: supplier.notes ?? "",
            }
          : { name: "", phone: "", email: "", address: "", notes: "" }
      );
      setServerError(null);
    }
  }, [open, supplier, reset]);

  async function onSubmit(data: SupplierInput) {
    setServerError(null);
    const result = isEditing
      ? await updateSupplier(supplier.id, data)
      : await createSupplier(data);

    if (!result.success) {
      setServerError(result.error);
      return;
    }
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !isSubmitting) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit supplier" : "Add supplier"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="s-name">Name *</Label>
              <Input id="s-name" placeholder="e.g. Kamau Spares Ltd" {...register("name")} />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="s-phone">Phone *</Label>
              <Input id="s-phone" placeholder="+254 7XX XXX XXX" {...register("phone")} />
              {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="s-email">
              Email <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Input id="s-email" type="email" placeholder="supplier@example.com" {...register("email")} />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="s-address">
              Address <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Input id="s-address" placeholder="Street, area, town…" {...register("address")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="s-notes">
              Notes <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Textarea
              id="s-notes"
              placeholder="Payment terms, lead time, special conditions…"
              rows={2}
              {...register("notes")}
              className="resize-none"
            />
          </div>

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
              {isEditing ? "Save changes" : "Add supplier"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

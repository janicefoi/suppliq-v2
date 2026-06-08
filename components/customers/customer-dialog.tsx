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
import { createCustomer, updateCustomer } from "@/lib/actions/customers";
import { CustomerSchema, type CustomerInput } from "@/lib/validations/customers";
import type { CustomerRow } from "@/lib/actions/customers";

interface CustomerDialogProps {
  open: boolean;
  onClose: () => void;
  customer: CustomerRow | null;
  onSuccess: () => void;
  branches?: { id: string; name: string }[];
  role?: string;
}

export function CustomerDialog({ open, onClose, customer, onSuccess, branches = [], role }: CustomerDialogProps) {
  const isEditing = customer !== null;
  const isAdmin = role === "ADMIN";
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CustomerInput>({
    resolver: zodResolver(CustomerSchema),
    defaultValues: { name: "", phone: "", address: "", branchId: null },
  });

  const selectedBranchId = watch("branchId");

  useEffect(() => {
    if (open) {
      reset(
        customer
          ? { name: customer.name, phone: customer.phone, address: customer.address ?? "", branchId: customer.branchId }
          : { name: "", phone: "", address: "", branchId: null }
      );
      setServerError(null);
    }
  }, [open, customer, reset]);

  async function onSubmit(data: CustomerInput) {
    setServerError(null);
    const result = isEditing
      ? await updateCustomer(customer.id, data)
      : await createCustomer(data);

    if (!result.success) {
      setServerError(result.error);
      return;
    }
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !isSubmitting) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit customer" : "Add customer"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Name *</Label>
            <Input id="c-name" placeholder="e.g. John Mwangi" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-phone">Phone *</Label>
            <Input id="c-phone" placeholder="+254 7XX XXX XXX" {...register("phone")} />
            {errors.phone && (
              <p className="text-xs text-red-500">{errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-address">
              Address <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Textarea
              id="c-address"
              placeholder="Street, area, town…"
              rows={2}
              {...register("address")}
              className="resize-none"
            />
          </div>

          {isAdmin && branches.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="c-branch">Branch</Label>
              <select
                id="c-branch"
                value={selectedBranchId ?? ""}
                onChange={(e) => setValue("branchId", e.target.value || null)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="">— No branch —</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
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
              {isEditing ? "Save changes" : "Add customer"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

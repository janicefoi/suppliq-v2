"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { createExpense, updateExpense, EXPENSE_CATEGORIES } from "@/lib/actions/expenses";
import type { ExpenseInput, ExpenseRow } from "@/lib/actions/expenses";

const ExpenseSchema = z.object({
  description: z.string().trim().min(1, "Description is required").max(300),
  amount: z.number().positive("Amount must be greater than 0"),
  category: z.enum(["RENT", "SALARIES", "UTILITIES", "TRANSPORT", "MAINTENANCE", "MARKETING", "OTHER"]),
  date: z.string().min(1, "Date is required"),
  branchId: z.string().nullable().optional(),
});

type Branch = { id: string; name: string };

interface ExpenseDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  expense?: ExpenseRow | null;
  branches: Branch[];
  defaultBranchId?: string | null;
  isAdmin: boolean;
}

function toDateInput(iso: string) {
  return iso.slice(0, 10);
}

export function ExpenseDialog({
  open,
  onClose,
  onSuccess,
  expense,
  branches,
  defaultBranchId,
  isAdmin,
}: ExpenseDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!expense;

  const today = new Date().toISOString().slice(0, 10);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseInput>({
    resolver: zodResolver(ExpenseSchema),
    defaultValues: {
      description: "",
      amount: undefined,
      category: "OTHER",
      date: today,
      branchId: defaultBranchId ?? null,
    },
  });

  useEffect(() => {
    if (open) {
      setServerError(null);
      if (expense) {
        reset({
          description: expense.description,
          amount: expense.amount,
          category: expense.category as ExpenseInput["category"],
          date: toDateInput(expense.date),
          branchId: expense.branchId ?? null,
        });
      } else {
        reset({
          description: "",
          amount: undefined as unknown as number,
          category: "OTHER",
          date: today,
          branchId: defaultBranchId ?? null,
        });
      }
    }
  }, [open, expense]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(data: ExpenseInput) {
    setServerError(null);
    const result = isEdit
      ? await updateExpense(expense!.id, data)
      : await createExpense(data);
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
          <DialogTitle>{isEdit ? "Edit expense" : "Record expense"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description *</Label>
            <Input
              {...register("description")}
              placeholder="e.g. January rent payment"
              autoFocus
            />
            {errors.description && (
              <p className="text-xs text-red-500">{errors.description.message}</p>
            )}
          </div>

          {/* Amount + Category in a row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount *</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                {...register("amount", { valueAsNumber: true })}
                className="tabular-nums"
              />
              {errors.amount && (
                <p className="text-xs text-red-500">{errors.amount.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Category *</Label>
              <select
                {...register("category")}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              {errors.category && (
                <p className="text-xs text-red-500">{errors.category.message}</p>
              )}
            </div>
          </div>

          {/* Date + Branch in a row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input
                type="date"
                {...register("date")}
                className="tabular-nums"
              />
              {errors.date && (
                <p className="text-xs text-red-500">{errors.date.message}</p>
              )}
            </div>

            {(isAdmin || branches.length > 0) && (
              <div className="space-y-1.5">
                <Label>Branch <span className="text-slate-400 font-normal">(optional)</span></Label>
                <Controller
                  control={control}
                  name="branchId"
                  render={({ field }) => (
                    <select
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || null)}
                      className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="">— No branch —</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  )}
                />
              </div>
            )}
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
              {isEdit ? "Save changes" : "Record expense"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

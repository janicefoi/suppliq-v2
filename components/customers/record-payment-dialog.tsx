"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { recordCreditPayment } from "@/lib/actions/customers";

function makeSchema(maxAmount: number) {
  return z.object({
    amount: z
      .number({ invalid_type_error: "Enter a valid amount" })
      .positive("Amount must be greater than zero")
      .max(maxAmount, `Cannot exceed the balance of KES ${maxAmount.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`),
    notes: z.string().optional(),
  });
}

function fmtKES(n: number) {
  return `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface RecordPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  creditBalance: number;
  onSuccess: () => void;
}

export function RecordPaymentDialog({
  open,
  onClose,
  customerId,
  customerName,
  creditBalance,
  onSuccess,
}: RecordPaymentDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = makeSchema(creditBalance);
  type PaymentInput = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PaymentInput>({
    resolver: zodResolver(schema),
    defaultValues: { amount: undefined, notes: "" },
  });

  const amountValue = watch("amount");
  const remaining = creditBalance - (Number(amountValue) || 0);
  const isFullPayment = Number(amountValue) === creditBalance;
  const exceedsBalance = Number(amountValue) > creditBalance;

  useEffect(() => {
    if (open) {
      reset({ amount: undefined, notes: "" });
      setServerError(null);
    }
  }, [open, reset]);

  async function onSubmit(data: PaymentInput) {
    setServerError(null);
    const result = await recordCreditPayment(customerId, data.amount, data.notes ?? null);
    if (!result.success) {
      setServerError(result.error);
      return;
    }
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !isSubmitting) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Record Credit Payment</DialogTitle>
          <DialogDescription>
            {customerName} &mdash; balance:{" "}
            <span className="font-semibold text-red-600">{fmtKES(creditBalance)}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="pay-amount">Amount paid (KES) *</Label>
              <button
                type="button"
                onClick={() => setValue("amount", creditBalance, { shouldValidate: true })}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-medium"
              >
                Pay full balance
              </button>
            </div>
            <Input
              id="pay-amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              {...register("amount", { valueAsNumber: true })}
              className={cn("tabular-nums", exceedsBalance && "border-red-300 focus-visible:ring-red-400")}
            />
            {errors.amount && (
              <p className="text-xs text-red-500">{errors.amount.message}</p>
            )}
            {amountValue > 0 && !exceedsBalance && (
              <div className={cn(
                "flex items-center gap-1.5 text-xs",
                isFullPayment ? "text-green-600 font-medium" : "text-slate-500"
              )}>
                {isFullPayment && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                {isFullPayment
                  ? "Full balance — account will be cleared"
                  : <>Remaining balance: <span className="font-medium text-slate-700">{fmtKES(remaining)}</span></>
                }
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-notes">
              Notes <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Textarea
              id="pay-notes"
              placeholder="e.g. Paid via M-Pesa, ref XXXXX"
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
            <Button type="submit" disabled={isSubmitting || creditBalance <= 0} className="gap-1.5">
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Record payment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

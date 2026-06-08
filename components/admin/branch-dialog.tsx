"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBranch, updateBranch } from "@/lib/actions/branches";
import type { BranchRow } from "@/lib/actions/branches";

const BranchFormSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  address: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(100).optional(),
  paybill: z.string().trim().max(20).optional(),
  pin: z.string().trim().max(20).optional(),
});

type BranchFormValues = z.infer<typeof BranchFormSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  branch: BranchRow | null;
  onSuccess: () => void;
}

export function BranchDialog({ open, onClose, branch, onSuccess }: Props) {
  const isEditing = branch !== null;
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<BranchFormValues>({
    resolver: zodResolver(BranchFormSchema),
    defaultValues: { name: "", address: "", phone: "", paybill: "", pin: "" },
  });

  useEffect(() => {
    if (open) {
      setServerError(null);
      form.reset(
        branch
          ? { name: branch.name, address: branch.address ?? "", phone: branch.phone ?? "", paybill: branch.paybill ?? "", pin: branch.pin ?? "" }
          : { name: "", address: "", phone: "", paybill: "", pin: "" }
      );
    }
  }, [open, branch]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(data: BranchFormValues) {
    setServerError(null);
    const result = isEditing
      ? await updateBranch(branch.id, data)
      : await createBranch(data);
    if (!result.success) { setServerError(result.error); return; }
    onSuccess();
  }

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !isSubmitting) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit branch" : "Add branch"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="b-name">Branch name</Label>
            <Input id="b-name" placeholder="e.g. Branch 1" {...form.register("name")} />
            {form.formState.errors.name && <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-address">Address <span className="text-slate-400 font-normal">(optional)</span></Label>
            <Input id="b-address" placeholder="e.g. Main Street, Eldoret" {...form.register("address")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-phone">Phone <span className="text-slate-400 font-normal">(optional)</span></Label>
            <Input id="b-phone" placeholder="e.g. 0712345678 / 0722345678" {...form.register("phone")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-paybill">Paybill no. <span className="text-slate-400 font-normal">(optional)</span></Label>
            <Input id="b-paybill" placeholder="e.g. 315469" {...form.register("paybill")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-pin">PIN <span className="text-slate-400 font-normal">(optional)</span></Label>
            <Input id="b-pin" placeholder="e.g. P0S1656847U" {...form.register("pin")} />
          </div>
          {serverError && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {serverError}
            </div>
          )}
          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
              {isEditing ? "Save changes" : "Add branch"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

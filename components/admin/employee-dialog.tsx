"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createEmployee, updateEmployee } from "@/lib/actions/employees";
import {
  CreateEmployeeSchema, UpdateEmployeeSchema,
  type CreateEmployeeInput, type UpdateEmployeeInput,
} from "@/lib/validations/employees";
import type { EmployeeRow } from "@/lib/actions/employees";

type BranchOption = { id: string; name: string };

interface EmployeeDialogProps {
  open: boolean;
  onClose: () => void;
  employee: EmployeeRow | null;
  onSuccess: () => void;
  branches: BranchOption[];
}

type CreateWithBranch = CreateEmployeeInput & { branchId?: string | null };
type UpdateWithBranch = UpdateEmployeeInput & { branchId?: string | null };

export function EmployeeDialog({ open, onClose, employee, onSuccess, branches }: EmployeeDialogProps) {
  const isEditing = employee !== null;
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [createBranchId, setCreateBranchId] = useState<string>("");
  const [updateBranchId, setUpdateBranchId] = useState<string>("");

  const createForm = useForm<CreateEmployeeInput>({
    resolver: zodResolver(CreateEmployeeSchema),
    defaultValues: { name: "", email: "", role: undefined, password: "" },
  });

  const updateForm = useForm<UpdateEmployeeInput>({
    resolver: zodResolver(UpdateEmployeeSchema),
    defaultValues: { name: "", email: "", role: undefined },
  });

  useEffect(() => {
    if (open) {
      setServerError(null);
      setShowPassword(false);
      if (employee) {
        updateForm.reset({
          name: employee.name,
          email: employee.email,
          role: employee.role as "CASHIER" | "MANAGER" | "ADMIN",
        });
        setUpdateBranchId(employee.branchId ?? "");
      } else {
        createForm.reset({ name: "", email: "", role: undefined, password: "" });
        setCreateBranchId("");
      }
    }
  }, [open, employee]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onCreateSubmit(data: CreateEmployeeInput) {
    setServerError(null);
    const payload: CreateWithBranch = { ...data, branchId: createBranchId || null };
    const result = await createEmployee(payload as CreateEmployeeInput);
    if (!result.success) { setServerError(result.error); return; }
    onSuccess();
  }

  async function onUpdateSubmit(data: UpdateEmployeeInput) {
    setServerError(null);
    const payload: UpdateWithBranch = { ...data, branchId: updateBranchId || null };
    const result = await updateEmployee(employee!.id, payload as UpdateEmployeeInput);
    if (!result.success) { setServerError(result.error); return; }
    onSuccess();
  }

  const isSubmitting = isEditing ? updateForm.formState.isSubmitting : createForm.formState.isSubmitting;

  const BranchSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? "" : v)}>
      <SelectTrigger>
        <SelectValue placeholder="No branch (admin)" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No branch (admin)</SelectItem>
        {branches.map((b) => (
          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !isSubmitting) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit employee" : "Add employee"}</DialogTitle>
        </DialogHeader>

        {isEditing ? (
          <form onSubmit={updateForm.handleSubmit(onUpdateSubmit)} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="e-name">Name</Label>
              <Input id="e-name" placeholder="Full name" {...updateForm.register("name")} />
              {updateForm.formState.errors.name && <p className="text-xs text-red-500">{updateForm.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-email">Email</Label>
              <Input id="e-email" type="email" placeholder="employee@jsh.co.ke" {...updateForm.register("email")} />
              {updateForm.formState.errors.email && <p className="text-xs text-red-500">{updateForm.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Controller control={updateForm.control} name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Select role…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASHIER">Cashier</SelectItem>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {updateForm.formState.errors.role && <p className="text-xs text-red-500">{updateForm.formState.errors.role.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Branch</Label>
              <BranchSelect value={updateBranchId} onChange={setUpdateBranchId} />
              <p className="text-[10px] text-slate-400">Admins can have no branch to see all data.</p>
            </div>
            {serverError && <ErrorBanner message={serverError} />}
            <FormFooter onClose={onClose} isSubmitting={isSubmitting} isEditing />
          </form>
        ) : (
          <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="ce-name">Name</Label>
              <Input id="ce-name" placeholder="Full name" {...createForm.register("name")} />
              {createForm.formState.errors.name && <p className="text-xs text-red-500">{createForm.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ce-email">Email</Label>
              <Input id="ce-email" type="email" placeholder="employee@jsh.co.ke" {...createForm.register("email")} />
              {createForm.formState.errors.email && <p className="text-xs text-red-500">{createForm.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Controller control={createForm.control} name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Select role…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASHIER">Cashier</SelectItem>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {createForm.formState.errors.role && <p className="text-xs text-red-500">{createForm.formState.errors.role.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Branch</Label>
              <BranchSelect value={createBranchId} onChange={setCreateBranchId} />
              <p className="text-[10px] text-slate-400">Admins can have no branch to see all data.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ce-password">Temporary password</Label>
              <div className="relative">
                <Input id="ce-password" type={showPassword ? "text" : "password"} placeholder="Min. 8 characters"
                  className="pr-10" {...createForm.register("password")} />
                <button type="button" onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600" tabIndex={-1}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {createForm.formState.errors.password && <p className="text-xs text-red-500">{createForm.formState.errors.password.message}</p>}
            </div>
            {serverError && <ErrorBanner message={serverError} />}
            <FormFooter onClose={onClose} isSubmitting={isSubmitting} isEditing={false} />
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      {message}
    </div>
  );
}

function FormFooter({ onClose, isSubmitting, isEditing }: { onClose: () => void; isSubmitting: boolean; isEditing: boolean }) {
  return (
    <div className="flex gap-2 justify-end pt-1">
      <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
      <Button type="submit" disabled={isSubmitting} className="gap-1.5">
        {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {isEditing ? "Save changes" : "Add employee"}
      </Button>
    </div>
  );
}

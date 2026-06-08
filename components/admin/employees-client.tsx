"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Power, KeyRound, UserCog } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmployeeDialog } from "@/components/admin/employee-dialog";
import { ResetPasswordDialog } from "@/components/admin/reset-password-dialog";
import { toggleEmployeeActive } from "@/lib/actions/employees";
import type { EmployeeRow } from "@/lib/actions/employees";
import { cn } from "@/lib/utils";

const ROLE_BADGE: Record<string, string> = {
  ADMIN:   "bg-blue-100 text-blue-700 border-blue-200",
  MANAGER: "bg-amber-100 text-amber-700 border-amber-200",
  CASHIER: "bg-slate-100 text-slate-600 border-slate-200",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

interface Props {
  employees: EmployeeRow[];
  currentUserId: string;
  branches: { id: string; name: string }[];
}

export function EmployeesClient({ employees, currentUserId, branches }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Dialogs
  const [addOpen, setAddOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<EmployeeRow | null>(null);
  const [resetEmployee, setResetEmployee] = useState<EmployeeRow | null>(null);

  function refresh() {
    setAddOpen(false);
    setEditEmployee(null);
    startTransition(() => router.refresh());
  }

  async function handleToggle(id: string) {
    setTogglingId(id);
    await toggleEmployeeActive(id);
    setTogglingId(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {employees.length} employee{employees.length !== 1 ? "s" : ""}
        </p>
        <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add employee
        </Button>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden [&_th]:h-8 [&_th]:py-2 [&_th]:text-[11px] [&_td]:py-2 [&_td]:align-middle">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="min-w-[160px]">Name</TableHead>
              <TableHead className="w-48">Email</TableHead>
              <TableHead className="w-24">Role</TableHead>
              <TableHead className="w-24">Branch</TableHead>
              <TableHead className="w-20">Status</TableHead>
              <TableHead className="w-28 whitespace-nowrap">Date joined</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-xs text-slate-400">
                  <UserCog className="h-7 w-7 mx-auto mb-1.5 opacity-30" />
                  No employees yet.
                </TableCell>
              </TableRow>
            ) : (
              employees.map((emp) => {
                const isSelf = emp.id === currentUserId;
                const isToggling = togglingId === emp.id;

                return (
                  <TableRow
                    key={emp.id}
                    className={cn(
                      "hover:bg-slate-50/60 transition-colors",
                      !emp.isActive && "opacity-60 bg-slate-50"
                    )}
                  >
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-slate-800">{emp.name}</span>
                        {isSelf && (
                          <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-full font-semibold">
                            You
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-xs text-slate-500 max-w-0">
                      <span className="block truncate" title={emp.email}>{emp.email}</span>
                    </TableCell>

                    <TableCell>
                      <Badge
                        className={cn(
                          "text-[10px] font-medium border px-1.5 py-0",
                          ROLE_BADGE[emp.role] ?? ROLE_BADGE.CASHIER
                        )}
                      >
                        {emp.role}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-xs text-slate-500">
                      {emp.branch ? emp.branch.name : <span className="text-slate-300">All</span>}
                    </TableCell>

                    <TableCell>
                      <Badge
                        className={cn(
                          "text-[10px] font-medium border px-1.5 py-0",
                          emp.isActive
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        )}
                      >
                        {emp.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-xs text-slate-500 tabular-nums">
                      {fmtDate(emp.createdAt)}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        {/* Edit — disabled for self only */}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-slate-400 hover:text-blue-600"
                          title="Edit employee"
                          disabled={isSelf}
                          onClick={() => setEditEmployee(emp)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>

                        {/* Reset password */}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-slate-400 hover:text-amber-600"
                          title="Reset password"
                          disabled={isSelf}
                          onClick={() => setResetEmployee(emp)}
                        >
                          <KeyRound className="h-3 w-3" />
                        </Button>

                        {/* Toggle active */}
                        <Button
                          size="icon"
                          variant="ghost"
                          className={cn(
                            "h-6 w-6",
                            emp.isActive
                              ? "text-slate-300 hover:text-red-500"
                              : "text-slate-300 hover:text-green-600"
                          )}
                          title={emp.isActive ? "Deactivate" : "Reactivate"}
                          disabled={isSelf || isToggling}
                          onClick={() => handleToggle(emp.id)}
                        >
                          <Power className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      <EmployeeDialog open={addOpen} onClose={() => setAddOpen(false)} employee={null} onSuccess={refresh} branches={branches} />
      <EmployeeDialog open={!!editEmployee} onClose={() => setEditEmployee(null)} employee={editEmployee} onSuccess={refresh} branches={branches} />
      {resetEmployee && (
        <ResetPasswordDialog
          open={!!resetEmployee}
          onClose={() => setResetEmployee(null)}
          employeeId={resetEmployee.id}
          employeeName={resetEmployee.name}
        />
      )}
    </div>
  );
}

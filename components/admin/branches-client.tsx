"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Power, MapPin, Phone, Users, GitBranch } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BranchDialog } from "@/components/admin/branch-dialog";
import { toggleBranchActive } from "@/lib/actions/branches";
import type { BranchRow } from "@/lib/actions/branches";
import { cn } from "@/lib/utils";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
}

interface Props { branches: BranchRow[] }

export function BranchesClient({ branches }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<BranchRow | null>(null);

  function refresh() {
    setDialogOpen(false);
    setEditBranch(null);
    startTransition(() => router.refresh());
  }

  async function handleToggle(id: string) {
    setTogglingId(id);
    await toggleBranchActive(id);
    setTogglingId(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">{branches.length} branch{branches.length !== 1 ? "es" : ""}</p>
        <Button size="sm" className="gap-1.5" onClick={() => { setEditBranch(null); setDialogOpen(true); }}>
          <Plus className="h-3.5 w-3.5" /> Add branch
        </Button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden [&_th]:h-8 [&_th]:py-2 [&_th]:text-[11px] [&_td]:py-2 [&_td]:align-middle">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="min-w-[140px]">Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead className="w-32">Phone</TableHead>
              <TableHead className="w-20 text-right">Staff</TableHead>
              <TableHead className="w-24 text-right">Customers</TableHead>
              <TableHead className="w-20 text-right">Sales</TableHead>
              <TableHead className="w-20">Status</TableHead>
              <TableHead className="w-28 whitespace-nowrap">Created</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-xs text-slate-400">
                  <GitBranch className="h-7 w-7 mx-auto mb-1.5 opacity-30" />
                  No branches yet.
                </TableCell>
              </TableRow>
            ) : (
              branches.map((b) => {
                const isToggling = togglingId === b.id;
                return (
                  <TableRow key={b.id} className={cn("hover:bg-slate-50/60", !b.isActive && "opacity-60 bg-slate-50")}>
                    <TableCell className="text-xs font-semibold text-slate-800">{b.name}</TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {b.address ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-slate-300 shrink-0" />{b.address}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {b.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-300 shrink-0" />{b.phone}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="flex items-center justify-end gap-1 text-xs text-slate-600">
                        <Users className="h-3 w-3 text-slate-300" />{b._count.users}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs text-slate-600">{b._count.customers}</TableCell>
                    <TableCell className="text-right text-xs text-slate-600">{b._count.sales}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-[10px] font-medium border px-1.5 py-0",
                        b.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-500 border-slate-200"
                      )}>
                        {b.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 tabular-nums">{fmtDate(b.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-400 hover:text-blue-600"
                          title="Edit branch" onClick={() => { setEditBranch(b); setDialogOpen(true); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost"
                          className={cn("h-6 w-6", b.isActive ? "text-slate-300 hover:text-red-500" : "text-slate-300 hover:text-green-600")}
                          title={b.isActive ? "Deactivate" : "Reactivate"}
                          disabled={isToggling}
                          onClick={() => handleToggle(b.id)}>
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

      <BranchDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditBranch(null); }}
        branch={editBranch}
        onSuccess={refresh}
      />
    </div>
  );
}

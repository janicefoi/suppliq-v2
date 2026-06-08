"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Search, Users, Pencil, ChevronRight,
  ArrowUpDown, ChevronUp, ChevronDown,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomerDialog } from "@/components/customers/customer-dialog";
import { CustomerStats } from "@/components/customers/customer-stats";
import { getCustomers, getCustomerStats } from "@/lib/actions/customers";
import type { CustomerRow, CustomerStats as CustomerStatsType } from "@/lib/actions/customers";
import { cn } from "@/lib/utils";

type Filter = "ALL" | "HAS_CREDIT" | "NO_CREDIT";
type SortField = "name" | "creditBalance" | "sales";
type SortDir = "asc" | "desc";

const TABS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "HAS_CREDIT", label: "Has credit" },
  { value: "NO_CREDIT", label: "No credit" },
];

function fmtKES(v: string | number) {
  return Number(v).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Props {
  customers: CustomerRow[];
  role: string;
  branches?: { id: string; name: string }[];
  initialStats: CustomerStatsType;
}

export function CustomersClient({ customers: initialCustomers, role, branches = [], initialStats }: Props) {
  const canEdit = role !== "CASHIER";
  const isAdmin = role === "ADMIN";
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Data state
  const [customers, setCustomers] = useState<CustomerRow[]>(initialCustomers);
  const [stats, setStats] = useState<CustomerStatsType>(initialStats);
  const [isSwitching, setIsSwitching] = useState(false);

  // Branch filter (admin only)
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);

  // Filters + sort
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<CustomerRow | null>(null);

  async function handleBranchChange(branchId: string | null) {
    setActiveBranchId(branchId);
    setIsSwitching(true);
    const [result, newStats] = await Promise.all([
      getCustomers("ALL", branchId),
      getCustomerStats(branchId),
    ]);
    setCustomers(result);
    setStats(newStats);
    setIsSwitching(false);
  }

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir(field === "creditBalance" ? "desc" : "asc"); }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return customers.filter((c) => {
      const bal = Number(c.creditBalance);
      if (filter === "HAS_CREDIT" && bal <= 0) return false;
      if (filter === "NO_CREDIT" && bal > 0) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.phone.includes(q)) return false;
      return true;
    });
  }, [customers, filter, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: number | string = 0, bv: number | string = 0;
      if (sortField === "name")          { av = a.name; bv = b.name; }
      if (sortField === "creditBalance") { av = Number(a.creditBalance); bv = Number(b.creditBalance); }
      if (sortField === "sales")         { av = a._count.sales; bv = b._count.sales; }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortField, sortDir]);

  const creditCount = useMemo(() => customers.filter((c) => Number(c.creditBalance) > 0).length, [customers]);

  function handleSuccess() {
    setDialogOpen(false);
    setEditCustomer(null);
    startTransition(() => router.refresh());
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 text-slate-300 ml-1 inline" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 text-blue-500 ml-1 inline" />
      : <ChevronDown className="h-3 w-3 text-blue-500 ml-1 inline" />;
  }

  const colSpan = isAdmin ? 7 : 6;

  return (
    <div className="space-y-4">

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      <CustomerStats stats={stats} />

      {/* ── Branch tabs (admin only) ──────────────────────────────────────── */}
      {isAdmin && branches.length > 0 && (
        <div className={cn("flex gap-1 bg-slate-100 rounded-lg p-1 w-fit transition-opacity", isSwitching && "opacity-50 pointer-events-none")}>
          {[{ id: null, name: "All Branches" }, ...branches.map((b) => ({ id: b.id, name: b.name }))].map((tab) => (
            <button
              key={tab.id ?? "all"}
              onClick={() => handleBranchChange(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                activeBranchId === tab.id
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* Credit filter tabs */}
          <div className="flex rounded-md border border-slate-200 overflow-hidden bg-white text-xs">
            {TABS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={cn(
                  "px-3 py-1.5 font-medium transition-colors whitespace-nowrap",
                  filter === value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                {label}
                {value === "HAS_CREDIT" && creditCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-red-100 text-red-700 text-[10px] font-semibold">
                    {creditCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Search name or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <Button size="sm" className="gap-1.5 shrink-0" onClick={() => { setEditCustomer(null); setDialogOpen(true); }}>
          <Plus className="h-3.5 w-3.5" />
          Add customer
        </Button>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden [&_th]:h-8 [&_th]:py-2 [&_th]:text-[11px] [&_td]:py-2 [&_td]:align-middle">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead
                className="min-w-[180px] cursor-pointer select-none"
                onClick={() => handleSort("name")}
              >
                Name <SortIcon field="name" />
              </TableHead>
              <TableHead className="w-36">Phone</TableHead>
              <TableHead className="w-48">Address</TableHead>
              {isAdmin && <TableHead className="w-36">Branch</TableHead>}
              <TableHead
                className="w-32 text-right whitespace-nowrap cursor-pointer select-none"
                onClick={() => handleSort("creditBalance")}
              >
                Credit balance <SortIcon field="creditBalance" />
              </TableHead>
              <TableHead
                className="w-20 text-right whitespace-nowrap cursor-pointer select-none"
                onClick={() => handleSort("sales")}
              >
                Sales <SortIcon field="sales" />
              </TableHead>
              <TableHead className="w-16 text-right whitespace-nowrap">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="py-12 text-center text-slate-400">
                  <Users className="h-7 w-7 mx-auto mb-1.5 opacity-30" />
                  <p className="text-xs">
                    {search || filter !== "ALL"
                      ? "No customers match your filters."
                      : "No customers yet — click \"Add customer\" to get started."}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((c) => {
                const balance = Number(c.creditBalance);
                const hasCredit = balance > 0;
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-blue-50/40 transition-colors"
                    onClick={() => router.push(`/customers/${c.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-800">{c.name}</span>
                        <ChevronRight className="h-3 w-3 text-slate-300" />
                      </div>
                    </TableCell>

                    <TableCell className="text-xs text-slate-600 tabular-nums">{c.phone}</TableCell>

                    <TableCell className="text-xs text-slate-500 max-w-0">
                      <span className="block truncate" title={c.address ?? undefined}>
                        {c.address ?? <span className="text-slate-300">—</span>}
                      </span>
                    </TableCell>

                    {isAdmin && (
                      <TableCell className="text-xs whitespace-nowrap">
                        {c.branch
                          ? <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{c.branch.name}</span>
                          : <span className="text-slate-300">—</span>}
                      </TableCell>
                    )}

                    <TableCell className="text-right whitespace-nowrap">
                      <span className={cn("text-xs font-semibold tabular-nums", hasCredit ? "text-red-600" : "text-green-600")}>
                        KES {fmtKES(balance)}
                      </span>
                    </TableCell>

                    <TableCell className="text-right">
                      <span className="text-xs text-slate-500 tabular-nums">{c._count.sales}</span>
                    </TableCell>

                    <TableCell className="text-right">
                      {canEdit && (
                        <Button
                          size="icon" variant="ghost"
                          className="h-6 w-6 text-slate-400 hover:text-blue-600"
                          title="Edit customer"
                          onClick={(e) => { e.stopPropagation(); setEditCustomer(c); setDialogOpen(true); }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {customers.length > 0 && (
        <p className="text-xs text-slate-400">
          Showing {sorted.length} of {customers.length} customer{customers.length !== 1 ? "s" : ""}
        </p>
      )}

      <CustomerDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditCustomer(null); }}
        customer={editCustomer}
        onSuccess={handleSuccess}
        branches={branches}
        role={role}
      />
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Receipt, TrendingDown, Plus, Download, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ExpenseDialog } from "@/components/expenses/expense-dialog";
import { deleteExpense } from "@/lib/actions/expenses";
import { EXPENSE_CATEGORIES } from "@/lib/constants/expenses";
import type { ExpenseRow, ExpenseStats } from "@/lib/actions/expenses";

type Branch = { id: string; name: string };

import { formatCurrency } from "@/lib/utils";

interface ExpensesClientProps {
  expenses: ExpenseRow[];
  stats: ExpenseStats;
  branches: Branch[];
  defaultBranchId?: string | null;
  isAdmin: boolean;
  currency: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const CATEGORY_COLORS: Record<string, string> = {
  RENT:        "bg-violet-50 text-violet-700 border-violet-200",
  SALARIES:    "bg-blue-50 text-blue-700 border-blue-200",
  UTILITIES:   "bg-cyan-50 text-cyan-700 border-cyan-200",
  TRANSPORT:   "bg-amber-50 text-amber-700 border-amber-200",
  MAINTENANCE: "bg-orange-50 text-orange-700 border-orange-200",
  MARKETING:   "bg-pink-50 text-pink-700 border-pink-200",
  OTHER:       "bg-slate-50 text-slate-600 border-slate-200",
};

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.value, c.label])
);

export function ExpensesClient({
  expenses,
  stats,
  branches,
  defaultBranchId,
  isAdmin,
  currency,
}: ExpensesClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterBranch, setFilterBranch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return expenses.filter((e) => {
      if (q && !e.description.toLowerCase().includes(q)) return false;
      if (filterCategory && e.category !== filterCategory) return false;
      if (filterBranch && e.branchId !== filterBranch) return false;
      return true;
    });
  }, [expenses, search, filterCategory, filterBranch]);

  const filteredTotal = filtered.reduce((s, e) => s + e.amount, 0);

  async function handleDelete(id: string) {
    if (!confirm("Delete this expense? This cannot be undone.")) return;
    setDeleting(id);
    await deleteExpense(id);
    setDeleting(null);
    router.refresh();
  }

  function downloadCSV() {
    const header = `Date,Description,Category,Amount (${currency}),Branch,Recorded By`;
    const rows = filtered.map((e) =>
      [
        fmtDate(e.date),
        `"${e.description}"`,
        CATEGORY_LABEL[e.category] ?? e.category,
        e.amount.toFixed(2),
        e.branch ? `"${e.branch.name}"` : "",
        `"${e.recordedBy.name}"`,
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Expenses</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track business costs by category and branch</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Record expense
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total expenses",      value: stats.totalExpenses.toLocaleString() },
          { label: "Total amount",        value: formatCurrency(stats.totalAmount, currency) },
          { label: "This month",          value: stats.thisMonthExpenses.toLocaleString() },
          { label: "This month amount",   value: formatCurrency(stats.thisMonthAmount, currency) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-slate-400" />
              <p className="text-xs text-slate-500">{label}</p>
            </div>
            <p className="text-lg font-bold text-slate-800 tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Category breakdown */}
      {stats.byCategory.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">By category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {stats.byCategory.map(({ category, total, count }) => (
              <div
                key={category}
                className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5"
              >
                <div>
                  <p className="text-xs font-medium text-slate-700">{CATEGORY_LABEL[category] ?? category}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{count} entry{count !== 1 ? "ies" : "y"}</p>
                </div>
                <p className="text-sm font-semibold text-slate-800 tabular-nums ml-3">
                  {formatCurrency(total, currency)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Search by description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:max-w-[160px]"
        >
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        {(isAdmin || branches.length > 1) && (
          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:max-w-[160px]"
          >
            <option value="">All branches</option>
            <option value="">No branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
        <div className="sm:ml-auto flex items-center gap-2">
          {filtered.length > 0 && (
            <span className="text-sm text-slate-500 tabular-nums">
              Total: <span className="font-semibold text-slate-700">{formatCurrency(filteredTotal, currency)}</span>
            </span>
          )}
          <Button variant="outline" size="sm" onClick={downloadCSV} className="gap-1.5 h-9">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Receipt className="h-10 w-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">
              {expenses.length === 0 ? "No expenses recorded yet" : "No expenses match your filters"}
            </p>
            {expenses.length === 0 && (
              <p className="text-xs text-slate-400 mt-1">Record your first business expense to get started.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Description</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Branch</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Recorded by</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDate(e.date)}</td>
                    <td className="px-4 py-3 text-slate-800 font-medium max-w-[240px] truncate">{e.description}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-xs font-medium border ${CATEGORY_COLORS[e.category] ?? CATEGORY_COLORS.OTHER}`}
                      >
                        {CATEGORY_LABEL[e.category] ?? e.category}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">
                      {formatCurrency(e.amount, currency)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {e.branch?.name ?? <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{e.recordedBy.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => { setEditing(e); setDialogOpen(true); }}
                          className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(e.id)}
                            disabled={deleting === e.id}
                            className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-slate-400 text-right">
          Showing {filtered.length} of {expenses.length} expense{expenses.length !== 1 ? "s" : ""}
        </p>
      )}

      <ExpenseDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => {
          setDialogOpen(false);
          setEditing(null);
          router.refresh();
        }}
        expense={editing}
        branches={branches}
        defaultBranchId={defaultBranchId}
        isAdmin={isAdmin}
      />
    </div>
  );
}

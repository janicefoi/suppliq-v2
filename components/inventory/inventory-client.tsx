"use client";

import React, { useState, useMemo, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getItems, getItemBranchStocks, toggleItemActive, type ItemBranchStock, type InventoryStats } from "@/lib/actions/inventory";
import {
  Plus, Pencil, Power, AlertTriangle, Search, Package, Tag, Lock,
  PackagePlus, Download, ArrowUpDown, ChevronUp, ChevronDown,
  ChevronRight, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ItemDialog, type DialogItem } from "@/components/inventory/item-dialog";
import { CategoryDialog } from "@/components/inventory/category-dialog";
import { StockInDialog } from "@/components/inventory/stock-in-dialog";
import { InventoryStats as InventoryStatsBar } from "@/components/inventory/inventory-stats";
import { cn } from "@/lib/utils";

export type InventoryItem = {
  id: string;
  sku: string;
  name: string;
  category: string;
  description: string | null;
  retailPrice: string;
  wholesalePrice: string;
  specialPrice: string | null;
  stockQty: number;
  lowStockThreshold: number;
  isActive: boolean;
  supplierId: string | null;
  supplier: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
};

interface Category { id: string; name: string }

interface Props {
  initialItems: InventoryItem[];
  initialStats: InventoryStats;
  suppliers: { id: string; name: string }[];
  categories: Category[];
  userRole: string;
  branches?: { id: string; name: string }[];
}

type SortField = "sku" | "name" | "category" | "retailPrice" | "stockQty";
type SortDir = "asc" | "desc";

function formatKES(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const num = Number(value);
  if (isNaN(num)) return "—";
  return `KES ${num.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function SortHeader({
  field, label, sortField, sortDir, onSort, className,
}: {
  field: SortField; label: string; sortField: SortField; sortDir: SortDir;
  onSort: (f: SortField) => void; className?: string;
}) {
  const active = sortField === field;
  const Icon = active ? (sortDir === "asc" ? ChevronUp : ChevronDown) : ArrowUpDown;
  return (
    <TableHead
      className={cn("cursor-pointer select-none whitespace-nowrap", className)}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <Icon className={cn("h-3 w-3", active ? "text-blue-500" : "text-slate-300")} />
      </span>
    </TableHead>
  );
}

export function InventoryClient({ initialItems, initialStats, suppliers, categories, userRole, branches = [] }: Props) {
  const isAdmin = userRole === "ADMIN";
  const isManager = userRole === "MANAGER";
  const canStockIn = isAdmin || isManager;
  const canManage = isAdmin;
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);

  // Branch switching
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>(initialItems);
  const [stats, setStats] = useState<InventoryStats>(initialStats);
  const [isSwitching, setIsSwitching] = useState(false);

  // Expand row — per-branch stock
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedStocks, setExpandedStocks] = useState<Record<string, ItemBranchStock[]>>({});
  const [loadingExpandId, setLoadingExpandId] = useState<string | null>(null);

  async function handleBranchChange(branchId: string | null) {
    setSelectedBranchId(branchId);
    setIsSwitching(true);
    setExpandedId(null);
    const [result] = await Promise.all([getItems(undefined, branchId)]);
    setItems(result);
    setIsSwitching(false);
  }

  async function handleToggleExpand(itemId: string) {
    if (expandedId === itemId) { setExpandedId(null); return; }
    setExpandedId(itemId);
    if (!expandedStocks[itemId]) {
      setLoadingExpandId(itemId);
      const stocks = await getItemBranchStocks(itemId);
      setExpandedStocks((prev) => ({ ...prev, [itemId]: stocks }));
      setLoadingExpandId(null);
    }
  }

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [stockStatus, setStockStatus] = useState<"all" | "in_stock" | "low" | "out">("all");
  const [showInactive, setShowInactive] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [stockInItem, setStockInItem] = useState<InventoryItem | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((item) => {
      if (!showInactive && !item.isActive) return false;
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (supplierFilter !== "all" && item.supplierId !== supplierFilter) return false;
      if (stockStatus === "out" && item.stockQty !== 0) return false;
      if (stockStatus === "low" && (item.stockQty === 0 || item.stockQty > item.lowStockThreshold)) return false;
      if (stockStatus === "in_stock" && item.stockQty <= item.lowStockThreshold) return false;
      if (q && !item.name.toLowerCase().includes(q) && !item.sku.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, categoryFilter, supplierFilter, stockStatus, showInactive]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (sortField === "sku")        { av = a.sku; bv = b.sku; }
      else if (sortField === "name")  { av = a.name; bv = b.name; }
      else if (sortField === "category") { av = a.category; bv = b.category; }
      else if (sortField === "retailPrice") { av = Number(a.retailPrice); bv = Number(b.retailPrice); }
      else if (sortField === "stockQty") { av = a.stockQty; bv = b.stockQty; }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredItems, sortField, sortDir]);

  const statsActive    = useMemo(() => items.filter((i) => i.isActive).length, [items]);
  const statsLowStock  = useMemo(() => items.filter((i) => i.isActive && i.stockQty <= i.lowStockThreshold).length, [items]);
  const statsInactive  = useMemo(() => items.filter((i) => !i.isActive).length, [items]);

  async function handleToggleActive(id: string) {
    setPendingToggleId(id);
    await toggleItemActive(id);
    setPendingToggleId(null);
    const result = await getItems(undefined, isAdmin ? selectedBranchId : undefined);
    setItems(result);
    startTransition(() => router.refresh());
  }

  async function handleSuccess() {
    setCreateOpen(false);
    setEditItem(null);
    setExpandedId(null);
    setExpandedStocks({});
    const result = await getItems(undefined, isAdmin ? selectedBranchId : undefined);
    setItems(result);
    startTransition(() => router.refresh());
  }

  function handleExport() {
    const headers = [
      "SKU", "Name", "Category", "Supplier",
      "Retail (KES)", "Wholesale (KES)", "Special (KES)",
      "Stock", "Low Stock At", "Status",
    ];
    const rows = sortedItems.map((item) => [
      item.sku,
      item.name,
      item.category,
      item.supplier?.name ?? "",
      Number(item.retailPrice).toFixed(2),
      Number(item.wholesalePrice).toFixed(2),
      item.specialPrice !== null ? Number(item.specialPrice).toFixed(2) : "",
      String(item.stockQty),
      String(item.lowStockThreshold),
      item.isActive ? "Active" : "Inactive",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jsh-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const sortProps = { sortField, sortDir, onSort: handleSort };

  return (
    <div className="space-y-4">

      {/* ── Inventory stats ───────────────────────────────────────────────── */}
      <InventoryStatsBar stats={stats} />

      {/* ── Branch tabs (admin only) ───────────────────────────────────────── */}
      {isAdmin && branches.length > 0 && (
        <div className={`flex gap-1 bg-slate-100 rounded-lg p-1 w-fit transition-opacity ${isSwitching ? "opacity-50 pointer-events-none" : ""}`}>
          {[{ id: null, name: "Combined" }, ...branches.map((b) => ({ id: b.id, name: b.name }))].map((tab) => (
            <button
              key={tab.id ?? "combined"}
              onClick={() => handleBranchChange(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                selectedBranchId === tab.id
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
        <div className="flex flex-1 flex-wrap gap-2 items-center">
          <div className="relative w-60">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Search name or SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          {suppliers.length > 0 && (
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="all">All suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}

          <select
            value={stockStatus}
            onChange={(e) => setStockStatus(e.target.value as typeof stockStatus)}
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="all">All stock levels</option>
            <option value="in_stock">In stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </select>

          <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer select-none">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
            Show inactive
          </label>
        </div>

        <div className="flex gap-2 shrink-0 items-center">
          {!canManage && !isManager && (
            <span className="flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1 font-medium">
              <Lock className="h-3 w-3" />
              View only
            </span>
          )}

          {initialItems.length > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          )}

          {canManage && (
            <>
              <Button variant="outline" size="sm" onClick={() => setCategoryDialogOpen(true)} className="gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                Categories
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add item
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden [&_th]:h-7 [&_th]:py-1.5 [&_th]:text-[11px] [&_td]:py-1 [&_td]:align-middle">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <SortHeader field="sku"        label="SKU"       className="w-24" {...sortProps} />
              <SortHeader field="name"       label="Name"      className="min-w-[200px]" {...sortProps} />
              <SortHeader field="category"   label="Category"  className="w-32" {...sortProps} />
              <SortHeader field="retailPrice" label="Retail"   className="w-28 text-right" {...sortProps} />
              <TableHead className="w-28 text-right whitespace-nowrap">Wholesale</TableHead>
              <TableHead className="w-28 text-right whitespace-nowrap">Special</TableHead>
              <SortHeader field="stockQty"   label="Stock"     className="w-16 text-right" {...sortProps} />
              <TableHead className="w-20 whitespace-nowrap">Status</TableHead>
              <TableHead className="w-20 text-right whitespace-nowrap">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-slate-400">
                  <Package className="h-7 w-7 mx-auto mb-1.5 opacity-30" />
                  <p className="text-xs">
                    {search || categoryFilter !== "all" || supplierFilter !== "all" || stockStatus !== "all"
                      ? "No items match your filters."
                      : canManage
                      ? "No items yet — click \"Add item\" to get started."
                      : "No items yet."}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              sortedItems.map((item) => {
                const isLow = item.stockQty <= item.lowStockThreshold;
                const isToggling = pendingToggleId === item.id;

                return (
                  <React.Fragment key={item.id}>
                  <TableRow
                    className={cn("transition-colors", !item.isActive && "opacity-50 bg-slate-50")}
                  >
                    <TableCell className="whitespace-nowrap font-mono text-[11px] text-slate-400">
                      {item.sku}
                    </TableCell>

                    {/* Name + supplier — click to expand */}
                    <TableCell className="max-w-0">
                      <button
                        className="flex items-center gap-1 text-left w-full group"
                        onClick={() => handleToggleExpand(item.id)}
                        title={isAdmin ? "Click to see per-branch stock" : undefined}
                      >
                        <ChevronRight className={cn(
                          "h-3 w-3 shrink-0 text-slate-300 transition-transform",
                          expandedId === item.id && "rotate-90 text-blue-500"
                        )} />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-xs text-slate-800 group-hover:text-blue-600 transition-colors" title={item.name}>
                            {item.name}
                          </div>
                          {item.supplier && (
                            <p className="text-[10px] text-slate-400 truncate">{item.supplier.name}</p>
                          )}
                        </div>
                      </button>
                    </TableCell>

                    <TableCell className="whitespace-nowrap">
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        {item.category}
                      </span>
                    </TableCell>

                    <TableCell className="text-right whitespace-nowrap text-xs tabular-nums">
                      {formatKES(item.retailPrice)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap text-xs tabular-nums">
                      {formatKES(item.wholesalePrice)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap text-xs tabular-nums text-slate-400">
                      {formatKES(item.specialPrice)}
                    </TableCell>

                    {/* Stock with threshold ratio */}
                    <TableCell className="text-right whitespace-nowrap">
                      <span className={cn("text-xs font-semibold", isLow ? "text-red-600" : "text-slate-700")}>
                        {isLow && <AlertTriangle className="inline h-3 w-3 mr-0.5 mb-0.5" />}
                        {item.stockQty}
                      </span>
                      <p className="text-[9px] text-slate-300 tabular-nums">
                        min {item.lowStockThreshold}
                      </p>
                    </TableCell>

                    <TableCell className="whitespace-nowrap">
                      <Badge
                        className={cn(
                          "text-[10px] font-medium border px-1.5 py-0",
                          item.isActive
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        )}
                      >
                        {item.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>

                    <TableCell className="whitespace-nowrap">
                      {canStockIn ? (
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            size="icon" variant="ghost"
                            className="h-6 w-6 text-slate-400 hover:text-green-600"
                            onClick={() => setStockInItem(item)}
                            title="Stock in"
                            disabled={!item.isActive}
                          >
                            <PackagePlus className="h-3 w-3" />
                          </Button>
                          {canManage && (
                            <>
                              <Button
                                size="icon" variant="ghost"
                                className="h-6 w-6 text-slate-400 hover:text-blue-600"
                                onClick={() => setEditItem(item)}
                                title="Edit item"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon" variant="ghost"
                                className={cn("h-6 w-6", item.isActive ? "text-slate-300 hover:text-red-500" : "text-slate-300 hover:text-green-600")}
                                onClick={() => handleToggleActive(item.id)}
                                disabled={isToggling}
                                title={item.isActive ? "Deactivate" : "Restore"}
                              >
                                <Power className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-200">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                  {/* ── Expanded branch stock breakdown ─────────────────── */}
                  {expandedId === item.id && (
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableCell colSpan={9} className="py-3 px-6">
                        {loadingExpandId === item.id ? (
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Loading branch stock…
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                              Stock by branch
                            </p>
                            <div className="flex flex-wrap gap-3">
                              {(expandedStocks[item.id] ?? []).map((bs) => {
                                const isLow = bs.stockQty <= bs.lowStockThreshold;
                                const isOut = bs.stockQty === 0;
                                return (
                                  <div
                                    key={bs.branchId}
                                    className={cn(
                                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                                      isOut ? "border-red-200 bg-red-50" :
                                      isLow ? "border-amber-200 bg-amber-50" :
                                              "border-green-200 bg-green-50"
                                    )}
                                  >
                                    <span className="font-medium text-slate-700">{bs.branchName}</span>
                                    <span className={cn(
                                      "font-bold tabular-nums",
                                      isOut ? "text-red-600" : isLow ? "text-amber-600" : "text-green-700"
                                    )}>
                                      {isOut ? "OUT" : bs.stockQty}
                                    </span>
                                    <span className="text-slate-400">/ min {bs.lowStockThreshold}</span>
                                  </div>
                                );
                              })}
                            </div>
                            {item.description && (
                              <p className="text-xs text-slate-500 mt-2 italic">{item.description}</p>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Summary bar ──────────────────────────────────────────────────── */}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span>
            Showing {sortedItems.length} of {items.length} item{items.length !== 1 ? "s" : ""}
          </span>
          <div className="flex gap-3">
            <span>{statsActive} active</span>
            {statsLowStock > 0 && (
              <span className="text-amber-600 font-medium">{statsLowStock} low stock</span>
            )}
            {statsInactive > 0 && <span>{statsInactive} inactive</span>}
          </div>
        </div>
      )}

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      <StockInDialog
        open={!!stockInItem}
        onClose={() => setStockInItem(null)}
        item={stockInItem}
        branches={isAdmin ? branches : []}
        selectedBranchId={isAdmin ? selectedBranchId : null}
        onSuccess={async () => {
          setStockInItem(null);
          const result = await getItems(undefined, isAdmin ? selectedBranchId : undefined);
          setItems(result);
        }}
      />
      <CategoryDialog
        open={categoryDialogOpen}
        onClose={() => setCategoryDialogOpen(false)}
        categories={categories}
      />
      <ItemDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        item={null}
        suppliers={suppliers}
        categories={categories}
        onSuccess={handleSuccess}
        isAdmin={isAdmin}
      />
      <ItemDialog
        open={!!editItem}
        onClose={() => setEditItem(null)}
        item={editItem as DialogItem | null}
        suppliers={suppliers}
        categories={categories}
        onSuccess={handleSuccess}
        isAdmin={isAdmin}
      />
    </div>
  );
}

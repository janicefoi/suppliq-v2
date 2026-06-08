"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Pencil, Phone, Mail, MapPin, Calendar,
  Package, ClipboardList, AlertTriangle, Plus,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SupplierDialog } from "@/components/suppliers/supplier-dialog";
import { RecordPurchaseDialog } from "@/components/suppliers/record-purchase-dialog";
import type { SupplierDetail, SupplierRow } from "@/lib/actions/suppliers";
import { cn } from "@/lib/utils";

function fmtKES(v: string | number) {
  return `KES ${Number(v).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  supplier: SupplierDetail;
  role: string;
  branches?: { id: string; name: string }[];
  userBranchId?: string | null;
}

export function SupplierDetailClient({ supplier, role, branches = [], userBranchId }: Props) {
  const canEdit = role !== "CASHIER";
  const isAdmin = role === "ADMIN";
  const canRecordPurchase = role !== "CASHIER";
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  function handleSuccess() {
    setEditOpen(false);
    setPurchaseOpen(false);
    startTransition(() => router.refresh());
  }

  // Coerce to SupplierRow shape for SupplierDialog
  const supplierAsRow: SupplierRow = {
    id: supplier.id,
    name: supplier.name,
    phone: supplier.phone,
    email: supplier.email,
    address: supplier.address,
    notes: supplier.notes,
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
    _count: {
      items: supplier.items.length,
      purchaseOrders: supplier.purchaseOrders.length,
    },
  };

  const totalSpend = supplier.purchaseOrders.reduce(
    (sum, po) => sum + Number(po.costPrice) * po.quantity,
    0
  );

  return (
    <div className="space-y-6">

      {/* ── Back + Edit ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Link
          href="/suppliers"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Suppliers
        </Link>
        <div className="flex gap-2">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
          {canRecordPurchase && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setPurchaseOpen(true)}
              disabled={supplier.items.filter((i) => i.isActive).length === 0}
              title={
                supplier.items.filter((i) => i.isActive).length === 0
                  ? "No active items linked to this supplier"
                  : undefined
              }
            >
              <Plus className="h-3.5 w-3.5" />
              Record stock purchase
            </Button>
          )}
        </div>
      </div>

      {/* ── Top cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Info card */}
        <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h1 className="text-xl font-bold text-slate-900">{supplier.name}</h1>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Phone className="h-4 w-4 text-slate-400 shrink-0" />
              {supplier.phone}
            </div>
            {supplier.email && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                {supplier.email}
              </div>
            )}
            {supplier.address && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                {supplier.address}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
              Added{" "}
              {new Date(supplier.createdAt).toLocaleDateString("en-KE", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </div>
            {supplier.notes && (
              <p className="text-sm text-slate-500 bg-slate-50 rounded-md px-3 py-2 border border-slate-100">
                {supplier.notes}
              </p>
            )}
          </div>
        </div>

        {/* Stats card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
              Items supplied
            </p>
            <p className="text-3xl font-bold text-slate-900">{supplier.items.length}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
              Purchase orders
            </p>
            <p className="text-2xl font-bold text-slate-900">{supplier.purchaseOrders.length}</p>
          </div>
          {totalSpend > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                Total spend
              </p>
              <p className="text-lg font-bold text-slate-900 tabular-nums">{fmtKES(totalSpend)}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Items supplied ───────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
          <Package className="h-4 w-4 text-slate-400" />
          Items supplied
        </h2>
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden [&_th]:h-8 [&_th]:py-2 [&_th]:text-[11px] [&_td]:py-2 [&_td]:align-middle">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="w-24 whitespace-nowrap">SKU</TableHead>
                <TableHead className="min-w-[200px]">Name</TableHead>
                <TableHead className="w-32">Category</TableHead>
                <TableHead className="w-20 text-right whitespace-nowrap">Stock</TableHead>
                <TableHead className="w-28 text-right whitespace-nowrap">Retail price</TableHead>
                <TableHead className="w-20 whitespace-nowrap">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {supplier.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-xs text-slate-400">
                    No items linked to this supplier yet.
                  </TableCell>
                </TableRow>
              ) : (
                supplier.items.map((item) => {
                  const isLow = item.stockQty <= 5;
                  return (
                    <TableRow
                      key={item.id}
                      className={cn(
                        "cursor-pointer hover:bg-blue-50/40 transition-colors",
                        !item.isActive && "opacity-50 bg-slate-50"
                      )}
                      onClick={() => router.push(`/inventory`)}
                    >
                      <TableCell className="font-mono text-[11px] text-slate-400">
                        {item.sku}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-800 max-w-0">
                        <span className="block truncate" title={item.name}>{item.name}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          {item.category}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn("text-xs font-semibold", isLow ? "text-red-600" : "text-slate-700")}>
                          {isLow && <AlertTriangle className="inline h-3 w-3 mr-0.5 mb-0.5" />}
                          {item.stockQty}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-slate-600">
                        {fmtKES(item.retailPrice)}
                      </TableCell>
                      <TableCell>
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
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* ── Purchase order history ───────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
          <ClipboardList className="h-4 w-4 text-slate-400" />
          Purchase order history
        </h2>
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden [&_th]:h-8 [&_th]:py-2 [&_th]:text-[11px] [&_td]:py-2 [&_td]:align-middle">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="w-36 whitespace-nowrap">Date</TableHead>
                <TableHead className="min-w-[160px]">Item</TableHead>
                <TableHead className="w-20 text-right whitespace-nowrap">Qty</TableHead>
                <TableHead className="w-32 text-right whitespace-nowrap">Cost / unit</TableHead>
                <TableHead className="w-32 text-right whitespace-nowrap">Total cost</TableHead>
                <TableHead className="w-32 whitespace-nowrap">Recorded by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {supplier.purchaseOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-xs text-slate-400">
                    No purchase orders recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                supplier.purchaseOrders.map((po) => {
                  const lineTotal = Number(po.costPrice) * po.quantity;
                  return (
                    <TableRow key={po.id} className="hover:bg-slate-50/60">
                      <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                        {fmtDateTime(po.createdAt)}
                      </TableCell>
                      <TableCell>
                        <p className="text-xs font-medium text-slate-800">{po.item.name}</p>
                        <p className="font-mono text-[10px] text-slate-400">{po.item.sku}</p>
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums font-medium text-slate-700">
                        +{po.quantity}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-slate-600">
                        {fmtKES(po.costPrice)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums font-semibold text-slate-800">
                        {fmtKES(lineTotal)}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {po.recordedBy.name}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}
      <SupplierDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        supplier={supplierAsRow}
        onSuccess={handleSuccess}
      />
      <RecordPurchaseDialog
        open={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
        supplierId={supplier.id}
        supplierName={supplier.name}
        items={supplier.items}
        onSuccess={handleSuccess}
        isAdmin={isAdmin}
        branches={branches}
        defaultBranchId={userBranchId}
      />
    </div>
  );
}

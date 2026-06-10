"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RecordPurchaseDialog } from "@/components/suppliers/record-purchase-dialog";
import { getSupplierItems } from "@/lib/actions/purchases";
import type { SupplierForPO } from "@/lib/actions/purchases";
import type { SupplierRow } from "@/lib/actions/suppliers";

type Branch = { id: string; name: string };

interface NewPurchaseButtonProps {
  suppliers: SupplierRow[];
  branches: Branch[];
  isAdmin: boolean;
  defaultBranchId?: string | null;
}

export function NewPurchaseButton({
  suppliers,
  branches,
  isAdmin,
  defaultBranchId,
}: NewPurchaseButtonProps) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supplierData, setSupplierData] = useState<SupplierForPO | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  async function handleContinue() {
    if (!selectedId) return;
    setLoading(true);
    setError(null);
    const data = await getSupplierItems(selectedId);
    setLoading(false);
    if (!data) {
      setError("Could not load supplier items. Try again.");
      return;
    }
    setSupplierData(data);
    setPickerOpen(false);
    setFormOpen(true);
  }

  function handlePickerClose() {
    if (loading) return;
    setPickerOpen(false);
    setSelectedId("");
    setError(null);
  }

  return (
    <>
      <Button
        onClick={() => {
          setSelectedId("");
          setError(null);
          setPickerOpen(true);
        }}
        className="gap-1.5"
      >
        <Plus className="h-4 w-4" />
        New purchase order
      </Button>

      {/* Step 1: Pick a supplier */}
      <Dialog open={pickerOpen} onOpenChange={(o) => { if (!o) handlePickerClose(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New purchase order</DialogTitle>
            <DialogDescription>Select the supplier you are buying from.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Supplier</Label>
              {suppliers.length === 0 ? (
                <p className="text-sm text-slate-500">No suppliers found. Add one from the Suppliers page first.</p>
              ) : (
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">— Select supplier —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handlePickerClose} disabled={loading}>
                Cancel
              </Button>
              <Button
                onClick={handleContinue}
                disabled={!selectedId || loading || suppliers.length === 0}
                className="gap-1.5"
              >
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Continue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Step 2: PO form (reuses existing dialog) */}
      {supplierData && (
        <RecordPurchaseDialog
          open={formOpen}
          onClose={() => setFormOpen(false)}
          supplierId={supplierData.id}
          supplierName={supplierData.name}
          items={supplierData.items}
          onSuccess={() => {
            setFormOpen(false);
            setSupplierData(null);
            router.refresh();
          }}
          isAdmin={isAdmin}
          branches={branches}
          defaultBranchId={defaultBranchId}
        />
      )}
    </>
  );
}

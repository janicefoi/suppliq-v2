"use client";

import { useEffect, useState } from "react";
import { Loader2, Tag, AlertCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { markdownItem } from "@/lib/actions/inventory";
import { formatCurrency } from "@/lib/utils";
import type { OverstockItem } from "@/app/(dashboard)/insights/overstock/page";

interface Props {
  item: OverstockItem | null;
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function MarkdownDialog({ item, currency, onClose, onSuccess }: Props) {
  const [price, setPrice]       = useState("");
  const [submitting, setSub]    = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setPrice(item.markdown_suggestion.suggested_price.toFixed(2));
      setError(null);
    }
  }, [item]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    const newPrice = parseFloat(price);
    if (isNaN(newPrice) || newPrice <= 0) {
      setError("Enter a valid price.");
      return;
    }
    if (newPrice >= item.retail_price) {
      setError("Markdown price must be lower than current retail price.");
      return;
    }
    setSub(true);
    setError(null);
    const result = await markdownItem(item.item_id, newPrice);
    setSub(false);
    if (!result.success) { setError(result.error); return; }
    onSuccess();
  }

  const parsedPrice = parseFloat(price) || 0;
  const saving = item ? item.retail_price - parsedPrice : 0;
  const discountPct = item && item.retail_price > 0
    ? ((saving / item.retail_price) * 100).toFixed(1)
    : "0";

  return (
    <Dialog open={item !== null} onOpenChange={(o) => { if (!o && !submitting) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-amber-500" />
            Apply markdown
          </DialogTitle>
          {item && (
            <DialogDescription>
              {item.item_name} · {item.sku}
            </DialogDescription>
          )}
        </DialogHeader>

        {item && (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Context strip */}
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5 space-y-1 text-xs">
              <div className="flex justify-between text-amber-800">
                <span>Days of cover</span>
                <span className="font-semibold">{item.days_of_cover}d</span>
              </div>
              <div className="flex justify-between text-amber-800">
                <span>Excess units</span>
                <span className="font-semibold">{item.excess_units}</span>
              </div>
              <div className="flex justify-between text-amber-800">
                <span>Capital tied</span>
                <span className="font-semibold">{formatCurrency(item.capital_tied, currency)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline">
                <Label>New retail price</Label>
                <span className="text-[10px] text-slate-400">
                  current: {formatCurrency(item.retail_price, currency)}
                </span>
              </div>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="tabular-nums"
                autoFocus
              />
              {parsedPrice > 0 && parsedPrice < item.retail_price && (
                <p className="text-[11px] text-green-600">
                  {discountPct}% discount · saves buyer {formatCurrency(saving, currency)} per unit
                </p>
              )}
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              This updates the retail price for <span className="font-medium">{item.item_name}</span> across all branches. The markdown accelerates sell-through and frees up working capital.
            </p>

            {error && (
              <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white">
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Apply markdown
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

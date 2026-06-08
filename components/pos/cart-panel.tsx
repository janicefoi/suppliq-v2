"use client";

import { useState, useTransition, useEffect } from "react";
import { Loader2, AlertCircle, RotateCcw, X, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CustomerSearch } from "@/components/pos/customer-search";
import { useCartStore, type SaleType, type PaymentStatus } from "@/lib/store/cart";
import { completeSale, type SaleResult } from "@/lib/actions/pos";
import { VAT_INCLUSIVE_LABEL } from "@/lib/constants/tax";
import { cn } from "@/lib/utils";

function fmt(v: number) {
  return `KES ${v.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface CartPanelProps {
  onSaleComplete: (sale: SaleResult, amountGiven: number) => void;
}

export function CartPanel({ onSaleComplete }: CartPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amountGiven, setAmountGiven] = useState<number>(0);
  const [showRestored, setShowRestored] = useState(false);
  // Start as true to match SSR; corrected on mount via effect
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);

  const {
    items,
    saleType,
    customerId,
    customerName,
    paymentStatus,
    discountAmount,
    setSaleType,
    setCustomer,
    setPaymentStatus,
    setDiscount,
    clearCart,
    subtotal,
    taxAmount,
    total,
  } = useCartStore();

  // Show banner when rehydration brings in items (items go from 0 → >0 on first load)
  useEffect(() => {
    const unsub = useCartStore.subscribe((state, prev) => {
      if (prev.items.length === 0 && state.items.length > 0) {
        setShowRestored(true);
        unsub();
      }
    });
    return unsub;
  }, []);

  const sub = subtotal();
  const tax = taxAmount();
  const tot = total();
  const discountError =
    items.length > 0 && discountAmount > 0 && discountAmount >= sub
      ? `Discount (${fmt(discountAmount)}) cannot equal or exceed the subtotal (${fmt(sub)})`
      : null;

  const SALE_TYPES: { value: SaleType; label: string }[] = [
    { value: "RETAIL", label: "Retail" },
    { value: "WHOLESALE", label: "Wholesale" },
  ];

  async function handleCompleteSale() {
    if (items.length === 0) return;
    if (discountError) return;
    if (paymentStatus === "CREDIT" && !customerId) {
      setError("Please select a customer for credit payment.");
      return;
    }

    // Verify actual server reachability before attempting the sale.
    // navigator.onLine is unreliable (loopback stays "online" even with WiFi off),
    // so we ping the server directly.
    try {
      const ping = await fetch("/api/ping", {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      });
      if (!ping.ok) throw new Error("ping failed");
    } catch {
      setIsOnline(false);
      setError("No connection to server — your cart is saved and will be ready when you reconnect.");
      return;
    }

    setIsOnline(true);
    setError(null);

    startTransition(async () => {
      try {
        const result = await completeSale({
          items: items.map((i) => ({
            itemId: i.itemId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            subtotal: i.subtotal,
          })),
          saleType,
          paymentStatus,
          customerId,
          discountAmount,
          totalAmount: tot,
        });

        if (!result.success) {
          setError(result.error);
          return;
        }

        clearCart();
        setAmountGiven(0);
        onSaleComplete(result.sale, amountGiven);
      } catch {
        setIsOnline(false);
        setError("Connection lost during sale — your cart is saved. Please try again when reconnected.");
      }
    });
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Offline banner ────────────────────────────────────────────── */}
      {!isOnline && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border-b border-red-200 text-red-800 text-xs">
          <WifiOff className="h-3.5 w-3.5 shrink-0 text-red-600" />
          <span>No internet connection — sales cannot be processed until you reconnect.</span>
        </div>
      )}

      {/* ── Restored cart banner ──────────────────────────────────────── */}
      {showRestored && items.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs">
          <RotateCcw className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span className="flex-1">Cart restored from your last session.</span>
          <button onClick={() => setShowRestored(false)} className="shrink-0 hover:text-amber-900">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Sale type ─────────────────────────────────────────────────── */}
      <div className="px-3 py-3 border-b border-slate-100">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Sale type
        </p>
        <div className="flex gap-1">
          {SALE_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setSaleType(value)}
              className={cn(
                "flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors",
                saleType === value
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-100"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Spacer so footer is pushed down ───────────────────────────── */}
      <div className="flex-1" />

      {/* ── Footer: customer + payment + totals ───────────────────────── */}
      <div className="border-t border-slate-100 px-3 py-3 space-y-3">

        {/* Customer */}
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
            Customer <span className="normal-case font-normal">(optional)</span>
          </p>
          <CustomerSearch
            selected={
              customerId
                ? { id: customerId, name: customerName ?? "", phone: "" }
                : null
            }
            onSelect={(c) => setCustomer(c?.id ?? null, c?.name ?? null)}
          />
        </div>

        {/* Payment */}
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
            Payment
          </p>
          <div className="flex gap-1">
            {(["PAID", "CREDIT"] as PaymentStatus[]).map((m) => {
              const creditWithoutCustomer = m === "CREDIT" && !customerId;
              return (
                <button
                  key={m}
                  onClick={() => !creditWithoutCustomer && setPaymentStatus(m)}
                  disabled={creditWithoutCustomer}
                  title={creditWithoutCustomer ? "Select a customer first." : undefined}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors",
                    paymentStatus === m
                      ? m === "CREDIT"
                        ? "bg-amber-500 text-white shadow-sm"
                        : "bg-green-600 text-white shadow-sm"
                      : creditWithoutCustomer
                      ? "text-slate-300 cursor-not-allowed bg-slate-50"
                      : "text-slate-500 hover:bg-slate-100"
                  )}
                >
                  {m === "PAID" ? "Cash / Paid" : "Credit"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Discount */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide shrink-0">
              Discount
            </label>
            <div className="ml-auto flex items-center gap-1">
              <span className="text-xs text-slate-400">KES</span>
              <input
                type="number"
                min="0"
                max={sub > 0 ? sub - 0.01 : undefined}
                step="0.01"
                value={discountAmount || ""}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className={cn(
                  "w-24 text-right text-xs tabular-nums px-2 py-1 rounded-md border focus:outline-none focus:ring-1",
                  discountError
                    ? "border-red-400 focus:ring-red-400 bg-red-50"
                    : "border-slate-200 focus:ring-ring"
                )}
              />
            </div>
          </div>
          {discountError && (
            <p className="text-[10px] text-red-600 text-right">{discountError}</p>
          )}
        </div>

        {/* Amount given — only for cash/paid sales */}
        {paymentStatus === "PAID" && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide shrink-0">
                Amount Given
              </label>
              <div className="ml-auto flex items-center gap-1">
                <span className="text-xs text-slate-400">KES</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountGiven || ""}
                  onChange={(e) => setAmountGiven(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className={cn(
                    "w-24 text-right text-xs tabular-nums px-2 py-1 rounded-md border focus:outline-none focus:ring-1",
                    amountGiven > 0 && amountGiven < tot
                      ? "border-red-400 focus:ring-red-400 bg-red-50"
                      : "border-slate-200 focus:ring-ring"
                  )}
                />
              </div>
            </div>
            {amountGiven > 0 && amountGiven < tot && (
              <p className="text-[10px] text-red-600 text-right">
                Amount given is less than total
              </p>
            )}
            {amountGiven >= tot && tot > 0 && (
              <div className="flex justify-between text-xs font-semibold text-green-700 bg-green-50 rounded-md px-2 py-1.5">
                <span>Change</span>
                <span className="tabular-nums">{fmt(amountGiven - tot)}</span>
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Totals */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} units)</span>
            <span className="tabular-nums">{fmt(sub)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-xs text-red-500">
              <span>Discount</span>
              <span className="tabular-nums">− {fmt(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-slate-900 pt-1">
            <span className="text-sm">Total</span>
            <span className="text-sm tabular-nums">{fmt(tot)}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-400 pt-0.5">
            <span>{VAT_INCLUSIVE_LABEL}</span>
            <span className="tabular-nums">{fmt(tax)}</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Complete button */}
        <Button
          className="w-full h-10 text-sm font-semibold"
          disabled={items.length === 0 || isPending || !!discountError || !isOnline}
          onClick={handleCompleteSale}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing…
            </>
          ) : (
            `Complete Sale · ${fmt(tot)}`
          )}
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import {
  Search, Trash2, Loader2, ShoppingCart, Package, Plus, X, Tag, AlertCircle, XCircle,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/store/cart";
import { searchItems, type SearchedItem } from "@/lib/actions/pos";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

function fmt(v: number) {
  return `KES ${v.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtP(v: string | number | null | undefined) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : fmt(n);
}

export function ItemSearch() {
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<SearchedItem | null>(null);
  const [addQty, setAddQty] = useState(1);
  const [useSpecialPrice, setUseSpecialPrice] = useState(false);
  const [results, setResults] = useState<SearchedItem[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [isFetching, startTransition] = useTransition();
  const debouncedQuery = useDebounce(query, 260);

  const dropRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);

  const {
    items: cartItems,
    addItem,
    removeItem,
    updateQuantity,
    setItemSpecialPrice,
    clearCart,
  } = useCartStore();

  // ── Available qty for the pending item (stock minus what's already in cart)
  const availableForPending = pending
    ? Math.max(0, pending.stockQty - (cartItems.find((i) => i.itemId === pending.id)?.quantity ?? 0))
    : 0;

  // Fetch search results
  useEffect(() => {
    if (!debouncedQuery.trim()) { setResults([]); return; }
    startTransition(async () => {
      const found = await searchItems(debouncedQuery);
      setResults(found);
      setShowDrop(true);
    });
  }, [debouncedQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  // Clear stock error whenever qty drops back into range
  useEffect(() => {
    if (stockError && addQty <= availableForPending) setStockError(null);
  }, [addQty, availableForPending, stockError]);

  // ── Handlers ────────────────────────────────────────────────────────────
  function pickItem(item: SearchedItem) {
    if (item.stockQty === 0) return;
    setPending(item);
    setShowDrop(false);
    setQuery("");
    setAddQty(1);
    setUseSpecialPrice(false);
    setStockError(null);
    setTimeout(() => qtyRef.current?.select(), 40);
  }

  function commitAdd() {
    if (!pending) return;

    if (addQty > availableForPending) {
      const existingInCart = cartItems.find((i) => i.itemId === pending.id)?.quantity ?? 0;
      const msg = existingInCart > 0
        ? `Only ${availableForPending} more unit${availableForPending !== 1 ? "s" : ""} available (${pending.stockQty} in stock, ${existingInCart} already in cart)`
        : `Only ${pending.stockQty} unit${pending.stockQty !== 1 ? "s" : ""} in stock`;
      setStockError(msg);
      return;
    }

    setStockError(null);
    addItem(pending, addQty, useSpecialPrice);
    setPending(null);
    setAddQty(1);
    setUseSpecialPrice(false);
    searchRef.current?.focus();
  }

  function cancelPending() {
    setPending(null);
    setAddQty(1);
    setUseSpecialPrice(false);
    setStockError(null);
    searchRef.current?.focus();
  }

  function setQty(v: number) {
    const clamped = Math.min(Math.max(1, v), availableForPending || 1);
    setAddQty(clamped);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ══ TOOLBAR ══════════════════════════════════════════════════════════ */}
      <div className="px-3 py-2 border-b border-slate-100 bg-slate-50 space-y-2">

        {/* Row 1 — search input */}
        <div ref={dropRef} className="relative">
          <div className="relative">
            {isFetching
              ? <Loader2 className="absolute left-3 top-2 h-4 w-4 text-slate-400 animate-spin pointer-events-none" />
              : <Search className="absolute left-3 top-2 h-4 w-4 text-slate-400 pointer-events-none" />
            }
            <input
              ref={searchRef}
              autoFocus
              type="text"
              value={query}
              placeholder="Search items by name or SKU…"
              onChange={(e) => { setQuery(e.target.value); setShowDrop(!!e.target.value.trim()); }}
              onFocus={() => results.length > 0 && setShowDrop(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setShowDrop(false); setQuery(""); }
                if (e.key === "Enter" && results.length > 0) pickItem(results[0]);
              }}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Results dropdown */}
          {showDrop && query.trim() && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white rounded-lg border border-slate-200 shadow-xl overflow-hidden">
              {results.length === 0 && !isFetching ? (
                <p className="px-4 py-4 text-center text-xs text-slate-400">
                  No results for &ldquo;{query}&rdquo;
                </p>
              ) : (
                <div className="max-h-52 overflow-y-auto divide-y divide-slate-50">
                  {results.map((item) => {
                    const oos = item.stockQty === 0;
                    const lowStock = !oos && item.stockQty <= 5;
                    return (
                      <button
                        key={item.id}
                        onClick={() => pickItem(item)}
                        disabled={oos}
                        className={cn(
                          "w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors",
                          oos ? "opacity-40 cursor-not-allowed" : "hover:bg-blue-50 active:bg-blue-100"
                        )}
                      >
                        <div className={cn(
                          "h-1.5 w-1.5 rounded-full shrink-0 mt-0.5",
                          oos ? "bg-red-400" : lowStock ? "bg-amber-400" : "bg-green-400"
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <span className="text-xs font-medium text-slate-800 truncate">{item.name}</span>
                            <span className="font-mono text-[10px] text-slate-400 shrink-0">{item.sku}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            <span className={cn("text-[10px]", oos ? "text-red-500" : lowStock ? "text-amber-500" : "text-slate-400")}>
                              {oos ? "Out of stock" : `${item.stockQty} in stock`}
                            </span>
                            <span className="text-[10px] text-slate-500">R {fmtP(item.retailPrice)}</span>
                            <span className="text-[10px] text-slate-500">WS {fmtP(item.wholesalePrice)}</span>
                            {item.specialPrice && (
                              <span className="text-[10px] text-purple-600 font-medium">Sp {fmtP(item.specialPrice)}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-300 shrink-0 font-mono">↵</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="px-3 py-1 bg-slate-50/80 border-t border-slate-100">
                <p className="text-[10px] text-slate-400">Click or ↵ to select · then set qty · press Enter to add</p>
              </div>
            </div>
          )}
        </div>

        {/* Row 2 — pending item + qty + add */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 min-h-[2rem]">
            {pending ? (
              <>
                {/* Selected item chip */}
                <div className="flex-1 min-w-0 flex items-center gap-2 bg-white border border-blue-200 rounded-lg px-2.5 py-1">
                  <Package className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-800 truncate leading-tight">{pending.name}</p>
                    <p className="text-[10px] font-mono text-slate-400">
                      {pending.sku}
                      {" · "}
                      <span className={cn(
                        "font-semibold",
                        availableForPending === 0 ? "text-red-500" : availableForPending <= 5 ? "text-amber-500" : "text-slate-400"
                      )}>
                        {availableForPending === 0 ? "none available" : `${availableForPending} avail.`}
                      </span>
                    </p>
                  </div>
                  <button onClick={cancelPending} className="text-slate-300 hover:text-slate-500 shrink-0 p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </div>

                {/* Qty stepper */}
                <div className="flex items-center border border-slate-200 rounded-md bg-white overflow-hidden shrink-0">
                  <button
                    onClick={() => setQty(addQty - 1)}
                    disabled={addQty <= 1}
                    className="px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 font-bold text-sm leading-none"
                  >−</button>
                  <input
                    ref={qtyRef}
                    type="number"
                    min={1}
                    max={availableForPending}
                    value={addQty}
                    onChange={e => setQty(parseInt(e.target.value) || 1)}
                    onKeyDown={e => { if (e.key === "Enter") commitAdd(); }}
                    className="w-14 text-center text-sm py-1 border-x border-slate-200 focus:outline-none focus:bg-blue-50"
                  />
                  <button
                    onClick={() => setQty(addQty + 1)}
                    disabled={addQty >= availableForPending}
                    className="px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 font-bold text-sm leading-none"
                  >+</button>
                </div>

                {/* Special price toggle */}
                <button
                  type="button"
                  onClick={() => pending.specialPrice && setUseSpecialPrice((v) => !v)}
                  disabled={!pending.specialPrice}
                  title={pending.specialPrice ? `Use special price ${fmtP(pending.specialPrice)}` : "No special price set for this item"}
                  className={cn(
                    "h-8 px-2.5 rounded-md border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shrink-0",
                    useSpecialPrice
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : pending.specialPrice
                      ? "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      : "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                  )}
                >
                  <Tag className="h-3.5 w-3.5" />
                  Special
                </button>

                {/* Add button */}
                <Button
                  size="sm"
                  className="h-8 px-3 gap-1 shrink-0"
                  onClick={commitAdd}
                  disabled={availableForPending <= 0}
                  title={availableForPending <= 0 ? "No stock available" : undefined}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add ↵
                </Button>
              </>
            ) : (
              <p className="text-xs text-slate-400">
                {query.trim()
                  ? "Select an item from the list above"
                  : "Search for an item · select it · set qty · press Enter ↵"}
              </p>
            )}
          </div>

          {/* Stock error */}
          {stockError && (
            <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {stockError}
            </div>
          )}
        </div>
      </div>

      {/* ══ CART TABLE ════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto">
        {cartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300">
            <ShoppingCart className="h-14 w-14" />
            <div className="text-center">
              <p className="text-sm font-medium text-slate-400">Cart is empty</p>
              <p className="text-xs text-slate-300 mt-0.5">Search → select → set qty → ↵ Enter</p>
            </div>
          </div>
        ) : (
          <div className="[&_td]:py-1 [&_th]:py-1.5 [&_th]:h-7 [&_th]:text-[11px] [&_td]:align-middle">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="w-8 text-center">#</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-32 text-center whitespace-nowrap">Quantity</TableHead>
                  <TableHead className="w-28 text-right whitespace-nowrap">Unit Price</TableHead>
                  <TableHead className="w-28 text-right whitespace-nowrap">Subtotal</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {cartItems.map((item, idx) => {
                  const atMax = item.quantity >= item.stockQty;
                  return (
                    <TableRow key={item.itemId} className="hover:bg-slate-50/60">
                      {/* Row # */}
                      <TableCell className="text-center text-[11px] font-medium text-slate-400">
                        {idx + 1}
                      </TableCell>

                      {/* Name + SKU */}
                      <TableCell>
                        <p className="text-xs font-medium text-slate-800 leading-tight">{item.name}</p>
                        <p className="font-mono text-[10px] text-slate-400">{item.sku}</p>
                      </TableCell>

                      {/* Qty stepper */}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center border border-slate-200 rounded-md overflow-hidden w-fit mx-auto">
                          <button
                            onClick={() => updateQuantity(item.itemId, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 text-xs font-bold leading-none"
                          >−</button>
                          <input
                            type="number"
                            min={1}
                            max={item.stockQty}
                            value={item.quantity}
                            onChange={e => {
                              const v = parseInt(e.target.value);
                              if (!isNaN(v) && v >= 1) updateQuantity(item.itemId, v);
                            }}
                            className="w-10 text-center text-xs py-0.5 border-x border-slate-200 focus:outline-none"
                          />
                          <button
                            onClick={() => updateQuantity(item.itemId, item.quantity + 1)}
                            disabled={atMax}
                            className="px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 text-xs font-bold leading-none"
                          >+</button>
                        </div>
                        {atMax && (
                          <p className="text-[9px] text-amber-500 mt-0.5 text-center">Max stock</p>
                        )}
                        <button
                          type="button"
                          onClick={() => setItemSpecialPrice(item.itemId, !item.useSpecialPrice)}
                          disabled={item.specialPrice === null}
                          title={item.specialPrice !== null ? `Use special price ${fmt(item.specialPrice)}` : "No special price set for this item"}
                          className={cn(
                            "mt-1 mx-auto h-5 px-1.5 rounded border text-[10px] font-semibold inline-flex items-center gap-1 transition-colors",
                            item.useSpecialPrice
                              ? "border-violet-500 bg-violet-50 text-violet-700"
                              : item.specialPrice !== null
                              ? "border-slate-200 text-slate-500 hover:bg-slate-50"
                              : "border-slate-100 text-slate-300 cursor-not-allowed"
                          )}
                        >
                          <Tag className="h-2.5 w-2.5" />
                          Special
                        </button>
                      </TableCell>

                      {/* Unit price */}
                      <TableCell className="text-right text-xs tabular-nums text-slate-600 whitespace-nowrap">
                        {fmt(item.unitPrice)}
                      </TableCell>

                      {/* Subtotal */}
                      <TableCell className="text-right text-xs tabular-nums font-semibold text-slate-800 whitespace-nowrap">
                        {fmt(item.subtotal)}
                      </TableCell>

                      {/* Remove */}
                      <TableCell className="text-center">
                        <button
                          onClick={() => removeItem(item.itemId)}
                          className="text-slate-300 hover:text-red-500 transition-colors p-0.5"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ══ FOOTER ════════════════════════════════════════════════════════════ */}
      {cartItems.length > 0 && (
        <div className="px-4 py-1.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] text-slate-400">
          <span>
            {cartItems.length} line item{cartItems.length !== 1 ? "s" : ""} ·{" "}
            {cartItems.reduce((s, i) => s + i.quantity, 0)} total units
          </span>
          <button
            onClick={clearCart}
            className="flex items-center gap-1 text-red-400 hover:text-red-600 font-medium transition-colors"
          >
            <XCircle className="h-3.5 w-3.5" />
            Clear cart
          </button>
        </div>
      )}
    </div>
  );
}

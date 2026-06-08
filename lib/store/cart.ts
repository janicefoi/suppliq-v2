import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { VAT_EXTRACT } from "@/lib/constants/tax";

export type SaleType = "RETAIL" | "WHOLESALE";
export type PaymentStatus = "PAID" | "CREDIT";

export interface CartItem {
  itemId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  stockQty: number;
  // All price tiers kept so prices update instantly when sale type switches
  retailPrice: number;
  wholesalePrice: number;
  specialPrice: number | null;
  useSpecialPrice: boolean;
}

export interface ItemForCart {
  id: string;
  name: string;
  sku: string;
  stockQty: number;
  retailPrice: string | number;
  wholesalePrice: string | number;
  specialPrice: string | number | null;
}

interface CartStore {
  items: CartItem[];
  saleType: SaleType;
  customerId: string | null;
  customerName: string | null;
  paymentStatus: PaymentStatus;
  discountAmount: number;

  addItem: (item: ItemForCart, qty?: number, useSpecialPrice?: boolean) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, qty: number) => void;
  setItemSpecialPrice: (itemId: string, useSpecialPrice: boolean) => void;
  setSaleType: (type: SaleType) => void;
  setCustomer: (id: string | null, name: string | null) => void;
  setPaymentStatus: (status: PaymentStatus) => void;
  setDiscount: (amount: number) => void;
  clearCart: () => void;

  subtotal: () => number;
  // VAT extracted from the VAT-inclusive total (total × 16/116)
  taxAmount: () => number;
  total: () => number;
}

function priceFor(
  item: Pick<CartItem, "retailPrice" | "wholesalePrice" | "specialPrice" | "useSpecialPrice">,
  type: SaleType
): number {
  if (item.useSpecialPrice && item.specialPrice !== null) return item.specialPrice;
  if (type === "WHOLESALE") return item.wholesalePrice;
  return item.retailPrice;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      saleType: "RETAIL",
      customerId: null,
      customerName: null,
      paymentStatus: "PAID",
      discountAmount: 0,

      addItem: (incoming, qty = 1, requestedSpecialPrice = false) => {
        const { items, saleType } = get();
        const addQty = Math.max(1, qty);
        const retailPrice = Number(incoming.retailPrice);
        const wholesalePrice = Number(incoming.wholesalePrice);
        const specialPrice =
          incoming.specialPrice !== null && incoming.specialPrice !== undefined
            ? Number(incoming.specialPrice)
            : null;
        const useSpecialPrice = requestedSpecialPrice && specialPrice !== null;

        const existing = items.find((i) => i.itemId === incoming.id);
        let updated: CartItem[];

        if (existing) {
          updated = items.map((i) =>
            i.itemId === incoming.id
              ? (() => {
                  const next = { ...i, useSpecialPrice, stockQty: incoming.stockQty };
                  const unitPrice = priceFor(next, saleType);
                  const quantity = i.quantity + addQty;
                  return { ...next, quantity, unitPrice, subtotal: quantity * unitPrice };
                })()
              : i
          );
        } else {
          const unitPrice = priceFor(
            { retailPrice, wholesalePrice, specialPrice, useSpecialPrice },
            saleType
          );
          updated = [
            ...items,
            {
              itemId: incoming.id,
              name: incoming.name,
              sku: incoming.sku,
              quantity: addQty,
              unitPrice,
              subtotal: unitPrice * addQty,
              stockQty: incoming.stockQty,
              retailPrice,
              wholesalePrice,
              specialPrice,
              useSpecialPrice,
            },
          ];
        }

        set({ items: updated });
      },

      removeItem: (itemId) =>
        set((s) => ({ items: s.items.filter((i) => i.itemId !== itemId) })),

      updateQuantity: (itemId, qty) => {
        if (qty < 1) return;
        set((s) => ({
          items: s.items.map((i) => {
            if (i.itemId !== itemId) return i;
            const safeQty = Math.min(qty, i.stockQty);
            return { ...i, quantity: safeQty, subtotal: safeQty * i.unitPrice };
          }),
        }));
      },

      setItemSpecialPrice: (itemId, useSpecialPrice) =>
        set((s) => ({
          items: s.items.map((item) => {
            if (item.itemId !== itemId || (useSpecialPrice && item.specialPrice === null)) {
              return item;
            }
            const next = { ...item, useSpecialPrice };
            const unitPrice = priceFor(next, s.saleType);
            return { ...next, unitPrice, subtotal: next.quantity * unitPrice };
          }),
        })),

      setSaleType: (type) =>
        set((s) => ({
          saleType: type,
          items: s.items.map((item) => {
            const unitPrice = priceFor(item, type);
            return { ...item, unitPrice, subtotal: item.quantity * unitPrice };
          }),
        })),

      setCustomer: (id, name) => set({ customerId: id, customerName: name }),
      setPaymentStatus: (paymentStatus) => set({ paymentStatus }),
      setDiscount: (discountAmount) => set({ discountAmount: Math.max(0, discountAmount) }),

      clearCart: () =>
        set({
          items: [],
          saleType: "RETAIL",
          customerId: null,
          customerName: null,
          paymentStatus: "PAID",
          discountAmount: 0,
        }),

      subtotal: () => get().items.reduce((sum, i) => sum + i.subtotal, 0),

      // VAT is INCLUSIVE in Kenya: extract it from the total rather than adding it
      taxAmount: () => {
        const tot = Math.max(0, get().subtotal() - get().discountAmount);
        return Math.round(tot * VAT_EXTRACT * 100) / 100;
      },

      // Total = subtotal − discount (VAT is already inside the prices)
      total: () => Math.max(0, get().subtotal() - get().discountAmount),
    }),
    {
      name: "jsh-pos-cart",
      storage: createJSONStorage(() => localStorage),
      // Skip auto-hydration on server render to avoid SSR/client mismatch.
      // POSClient calls rehydrate() manually after mount.
      skipHydration: true,
      // Only persist the data fields — not the computed functions
      partialize: (state) => ({
        items: state.items,
        saleType: state.saleType,
        customerId: state.customerId,
        customerName: state.customerName,
        paymentStatus: state.paymentStatus,
        discountAmount: state.discountAmount,
      }),
    }
  )
);

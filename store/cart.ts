import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, CartState } from "@/types";
import type { Item } from "@prisma/client";
import { SaleType, PaymentStatus } from "@prisma/client";

function unitPriceFor(item: Item, saleType: SaleType): number {
  if (saleType === SaleType.SPECIAL && item.specialPrice !== null) {
    return Number(item.specialPrice);
  }
  if (saleType === SaleType.WHOLESALE) {
    return Number(item.wholesalePrice);
  }
  return Number(item.retailPrice);
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      customerId: null,
      saleType: SaleType.RETAIL,
      paymentStatus: PaymentStatus.PAID,
      discountAmount: 0,
      note: "",

      addItem: (item: Item, qty = 1) => {
        const { items, saleType } = get();
        const unitPrice = unitPriceFor(item, saleType);
        const existing = items.find((i) => i.itemId === item.id);

        if (existing) {
          set({
            items: items.map((i) =>
              i.itemId === item.id
                ? { ...i, quantity: i.quantity + qty, subtotal: (i.quantity + qty) * i.unitPrice }
                : i
            ),
          });
        } else {
          const newItem: CartItem = {
            itemId: item.id,
            sku: item.sku,
            name: item.name,
            quantity: qty,
            unitPrice,
            subtotal: qty * unitPrice,
          };
          set({ items: [...items, newItem] });
        }
      },

      removeItem: (itemId: string) =>
        set({ items: get().items.filter((i) => i.itemId !== itemId) }),

      updateQty: (itemId: string, qty: number) =>
        set({
          items: get().items.map((i) =>
            i.itemId === itemId
              ? { ...i, quantity: qty, subtotal: qty * i.unitPrice }
              : i
          ),
        }),

      setCustomer: (customerId) => set({ customerId }),
      setSaleType: (saleType) => set({ saleType }),
      setPaymentStatus: (paymentStatus) => set({ paymentStatus }),
      setDiscount: (discountAmount) => set({ discountAmount }),
      setNote: (note) => set({ note }),

      clearCart: () =>
        set({
          items: [],
          customerId: null,
          saleType: SaleType.RETAIL,
          paymentStatus: PaymentStatus.PAID,
          discountAmount: 0,
          note: "",
        }),

      subtotal: () => get().items.reduce((sum, i) => sum + i.subtotal, 0),

      total: () => {
        const { discountAmount } = get();
        const sub = get().items.reduce((sum, i) => sum + i.subtotal, 0);
        return Math.max(0, sub - discountAmount);
      },
    }),
    { name: "jsh-pos-cart" }
  )
);

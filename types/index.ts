import type { DefaultSession } from "next-auth";
import type {
  User,
  Supplier,
  Item,
  Customer,
  Sale,
  SaleItem,
  CreditPayment,
  PurchaseOrder,
  Role,
  SaleType,
  PaymentStatus,
} from "@prisma/client";

// ── Prisma model re-exports ────────────────────────────────────────────────
export type {
  User,
  Supplier,
  Item,
  Customer,
  Sale,
  SaleItem,
  CreditPayment,
  PurchaseOrder,
  Role,
  SaleType,
  PaymentStatus,
};

// ── Extended types with relations ──────────────────────────────────────────
export type ItemWithSupplier = Item & {
  supplier: Supplier | null;
};

export type SaleWithRelations = Sale & {
  items: (SaleItem & { item: Item })[];
  customer: Customer | null;
  employee: Pick<User, "id" | "name">;
};

export type PurchaseOrderWithRelations = PurchaseOrder & {
  item: Item;
  supplier: Supplier;
  recordedBy: Pick<User, "id" | "name">;
};

// ── POS cart types (Zustand) ───────────────────────────────────────────────
export interface CartItem {
  itemId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number; // snapshot at time of sale
  subtotal: number;
}

export interface CartState {
  items: CartItem[];
  customerId: string | null;
  saleType: SaleType;
  paymentStatus: PaymentStatus;
  discountAmount: number;
  note: string;
  addItem: (item: Item, qty?: number) => void;
  removeItem: (itemId: string) => void;
  updateQty: (itemId: string, qty: number) => void;
  setCustomer: (customerId: string | null) => void;
  setSaleType: (type: SaleType) => void;
  setPaymentStatus: (status: PaymentStatus) => void;
  setDiscount: (amount: number) => void;
  setNote: (note: string) => void;
  clearCart: () => void;
  subtotal: () => number;
  total: () => number; // subtotal − discountAmount
}

// ── Dashboard ──────────────────────────────────────────────────────────────
export interface StatCard {
  label: string;
  value: string | number;
  change?: string;
  trend?: "up" | "down" | "neutral";
}

// ── NextAuth v5 type augmentation ─────────────────────────────────────────
declare module "next-auth" {
  interface User {
    role: string;
  }
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }
}

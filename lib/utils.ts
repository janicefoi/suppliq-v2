import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string, currency = "EUR"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatCurrencyCompact(amount: number | string, currency = "EUR"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  const symbol = new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 })
    .formatToParts(0)
    .find((p) => p.type === "currency")?.value ?? currency;
  if (num >= 1_000_000) return `${symbol} ${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${symbol} ${(num / 1_000).toFixed(0)}K`;
  return `${symbol} ${num.toFixed(0)}`;
}

export function generateInvoiceNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-${datePart}-${rand}`;
}

export function generatePurchaseRef(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PO-${datePart}-${rand}`;
}

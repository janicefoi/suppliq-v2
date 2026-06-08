import { z } from "zod";

export const CompleteSaleSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPrice: z.number().positive(),
        subtotal: z.number().positive(),
      })
    )
    .min(1, "Cart is empty"),
  saleType: z.enum(["RETAIL", "WHOLESALE"]),
  paymentStatus: z.enum(["PAID", "CREDIT"]),
  customerId: z.string().nullable(),
  discountAmount: z.number().min(0),
  totalAmount: z.number().min(0),
  // taxAmount is computed server-side (extracted from VAT-inclusive totalAmount)
});

export type CompleteSaleInput = z.infer<typeof CompleteSaleSchema>;

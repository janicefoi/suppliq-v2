import { z } from "zod";

export const SupplierSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  phone: z
    .string()
    .trim()
    .min(5, "Phone number must be at least 5 characters")
    .max(30, "Phone number is too long"),
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .or(z.literal(""))
    .optional(),
  address: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(500).optional(),
});

export type SupplierInput = z.infer<typeof SupplierSchema>;

const PurchaseLineSchema = z.object({
  itemId: z.string().min(1, "Select an item"),
  quantity: z
    .number({ invalid_type_error: "Enter a valid quantity" })
    .int()
    .positive("Must be at least 1")
    .max(99999, "Quantity seems unusually large"),
  costPrice: z
    .number({ invalid_type_error: "Enter a valid price" })
    .positive("Must be greater than zero"),
});

export const PurchaseOrderSchema = z.object({
  supplierId: z.string().min(1),
  branchId: z.string().nullable().optional(),
  items: z.array(PurchaseLineSchema).min(1, "Add at least one item"),
});

export type PurchaseLineInput = z.infer<typeof PurchaseLineSchema>;
export type PurchaseOrderInput = z.infer<typeof PurchaseOrderSchema>;

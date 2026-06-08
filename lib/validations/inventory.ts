import { z } from "zod";

const positiveDecimal = z.coerce
  .number({ invalid_type_error: "Must be a valid number" })
  .positive("Must be greater than 0")
  .multipleOf(0.01, "Max 2 decimal places");

export const ItemSchema = z
  .object({
    sku: z.string().trim().min(1, "SKU is required").max(50),
    name: z.string().trim().min(1, "Name is required").max(200),
    category: z.string().trim().min(1, "Category is required").max(100),
    description: z.string().trim().max(500).optional(),

    retailPrice: positiveDecimal,
    wholesalePrice: positiveDecimal,
    specialPrice: z.preprocess(
      (val) => (val === "" || val === null || val === undefined ? null : val),
      z.coerce.number().positive("Must be greater than 0").nullable()
    ),

    // Per-branch stock fields — only used when creating/editing for a specific branch
    stockQty: z.coerce
      .number({ invalid_type_error: "Must be a valid number" })
      .int("Must be a whole number")
      .min(0, "Cannot be negative")
      .optional()
      .default(0),

    lowStockThreshold: z.coerce
      .number({ invalid_type_error: "Must be a valid number" })
      .int("Must be a whole number")
      .min(1, "Must be at least 1")
      .optional()
      .default(5),

    supplierId: z.preprocess(
      (val) => (val === "" || val === null || val === undefined ? null : val),
      z.string().nullable()
    ),
  })
  .superRefine((data, ctx) => {
    if (data.wholesalePrice > data.retailPrice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Wholesale price cannot exceed the retail price",
        path: ["wholesalePrice"],
      });
    }
    if (data.specialPrice !== null && data.specialPrice >= data.retailPrice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Special price must be less than the retail price",
        path: ["specialPrice"],
      });
    }
  });

export type ItemFormValues = z.infer<typeof ItemSchema>;

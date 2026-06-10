import { z } from "zod";

export const CustomerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  phone: z
    .string()
    .trim()
    .min(5, "Phone number must be at least 5 characters")
    .max(30, "Phone number is too long"),
  address: z.string().trim().max(200).optional(),
  branchId: z.string().nullable().optional(),
});

export type CustomerInput = z.infer<typeof CustomerSchema>;

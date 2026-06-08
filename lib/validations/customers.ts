import { z } from "zod";

export const CustomerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  phone: z
    .string()
    .trim()
    .regex(
      /^(\+?254|0)[71]\d{8}$/,
      "Enter a valid Kenyan phone number (e.g. 0712345678 or +254712345678)"
    ),
  address: z.string().trim().max(200).optional(),
  branchId: z.string().nullable().optional(),
});

export type CustomerInput = z.infer<typeof CustomerSchema>;

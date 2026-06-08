import { z } from "zod";

export const CreateEmployeeSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  role: z.enum(["CASHIER", "MANAGER", "ADMIN"], { required_error: "Please select a role" }),
  password: z.string().min(8, "Password must be at least 8 characters"),
  branchId: z.string().nullable().optional(),
});

export const UpdateEmployeeSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  role: z.enum(["CASHIER", "MANAGER", "ADMIN"], { required_error: "Please select a role" }),
  branchId: z.string().nullable().optional(),
});

export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeSchema>;

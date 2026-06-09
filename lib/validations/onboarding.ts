import { z } from "zod";

export const OnboardingSchema = z
  .object({
    orgName: z.string().min(2, "Company name must be at least 2 characters"),
    industry: z.string().optional(),
    country: z.string().default("KE"),
    branchName: z
      .string()
      .min(2, "Branch name must be at least 2 characters"),
    adminName: z.string().min(2, "Your name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type OnboardingInput = z.infer<typeof OnboardingSchema>;

import { z } from "zod";

export const ProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address").max(200),
});
export type ProfileInput = z.infer<typeof ProfileSchema>;

export const PasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters").max(100),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type PasswordInput = z.infer<typeof PasswordSchema>;

export const OrgSchema = z.object({
  name:     z.string().min(1, "Organization name is required").max(200),
  industry: z.string().max(100).optional(),
  phone:    z.string().max(50).optional(),
  email:    z.string().email("Invalid email").max(200).optional().or(z.literal("")),
  address:  z.string().max(300).optional(),
  website:  z.string().max(200).optional(),
  taxId:    z.string().max(50).optional(),
  country:  z.string().min(2, "Country is required").max(10),
  currency: z.string().min(1, "Currency is required").max(10),
  timezone: z.string().min(1, "Timezone is required").max(60),
  vatRate:  z.coerce.number().min(0, "VAT rate cannot be negative").max(100, "VAT rate cannot exceed 100").default(20),
});
export type OrgInput = z.infer<typeof OrgSchema>;

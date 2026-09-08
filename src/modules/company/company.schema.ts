import { z } from "zod";

export const createCompanySchema = z.object({
  name: z.string().min(2),
  logoText: z.string().min(1).max(3),
  logoColor: z.string().min(1),
  taxId: z.string().min(3),
  currency: z.string().min(1).default("INR"),
  address: z.object({
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    zip: z.string().min(1),
    country: z.string().min(1),
  }),
  bank: z.object({
    accountName: z.string().min(1),
    accountNumber: z.string().min(1),
    bankName: z.string().min(1),
    ifsc: z.string().min(1),
    swiftCode: z.string().optional(),
    branch: z.string().optional(),
  }),
});
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

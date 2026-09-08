import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(2, "Customer name is required"),
  country: z.string().min(1, "Select a country"),
  email: z.string().email(),
  phone: z.string().min(7),
  address: z.string().min(4),
  gstin: z.string().optional(),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

// Same fields, all optional — a PATCH only sends what actually changed.
export const updateCustomerSchema = createCustomerSchema.partial();
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

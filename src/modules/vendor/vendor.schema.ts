import { z } from "zod";

export const createVendorSchema = z.object({
  name: z.string().min(2, "Vendor name is required"),
  country: z.string().min(1, "Select a country"),
  email: z.string().email(),
  phone: z.string().min(7),
  address: z.string().min(4),
  gstin: z.string().optional(),
  category: z.string().min(1, "Select a category"),
});
export type CreateVendorInput = z.infer<typeof createVendorSchema>;

export const updateVendorSchema = createVendorSchema.partial();
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;

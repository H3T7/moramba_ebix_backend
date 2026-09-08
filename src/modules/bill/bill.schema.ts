import { z } from "zod";

const itemSchema = z.object({
  productId: z.string().uuid().optional(),
  description: z.string().min(1, "Description is required"),
  hsCode: z.string().optional(),
  unit: z.string().min(1, "Unit is required"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  rate: z.coerce.number().min(0),
  taxPercent: z.coerce.number().min(0).max(100).default(0),
});

const importDetailsSchema = z.object({
  originCountry: z.string().min(1),
  destinationCountry: z.string().min(1),
  portOfLoading: z.string().optional(),
  portOfDischarge: z.string().optional(),
  shippingMethod: z.string().min(1),
  customsReference: z.string().optional(),
  shipmentDate: z.string().optional(),
});

export const createBillSchema = z.object({
  vendorId: z.string().uuid("Select a vendor"),
  currency: z.string().min(1).default("INR"),
  paymentTerms: z.enum(["Pay Advance", "Pay Later", "Letter of Credit", "50% Advance / 50% on Shipment"]).default("Pay Later"),
  advancePercent: z.coerce.number().min(0).max(100).default(0),
  importDetails: importDetailsSchema,
  requiredDocs: z.array(z.string()).default([]),
  items: z.array(itemSchema).min(1, "Add at least one line item"),
});
export type CreateBillInput = z.infer<typeof createBillSchema>;

export const updateBillSchema = createBillSchema.partial();
export type UpdateBillInput = z.infer<typeof updateBillSchema>;

export const updateBillStatusSchema = z.object({
  status: z.enum(["Draft", "Submitted", "Processing", "Documents Pending", "Ready", "Completed", "Cancelled"]),
});

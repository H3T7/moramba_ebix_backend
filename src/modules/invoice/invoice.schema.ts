import { z } from "zod";

const itemSchema = z.object({
  productId: z.string().uuid().optional(),
  description: z.string().min(1, "Description is required"),
  itemCode: z.string().optional(),
  sku: z.string().optional(),
  hsCode: z.string().optional(),
  unit: z.string().min(1, "Unit is required"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  rate: z.coerce.number().min(0),
  taxPercent: z.coerce.number().min(0).max(100).default(0),
});

const exportDetailsSchema = z.object({
  originCountry: z.string().min(1),
  destinationCountry: z.string().min(1),
  portOfLoading: z.string().optional(),
  portOfDischarge: z.string().optional(),
  shippingMethod: z.string().min(1),
  incoterm: z.string().optional(),
  shipmentDate: z.string().optional(),
  // Both new — exportDetails is stored as JSON (see schema.prisma's Invoice
  // model), so adding fields here needs no migration, same as incoterm
  // above. The frontend's normalizeInvoice() flattens these back out to
  // top-level invoice.issueDate/dueDate, which the dashboard/PDF/detail
  // pages all expect (see moramba-ebix-frontend/src/modules/invoice/slice.js).
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  // Also new — same zero-migration JSON approach. These were being
  // collected on the Billing step but never sent to the backend at all
  // (see InvoiceFormPage.jsx's buildInvoicePayload, which used to drop
  // them with a comment saying "the invoices table has no columns for
  // them yet" — this is that column). Without this, editing an invoice
  // always showed these fields empty, since nothing was ever there to
  // load back.
  billingAddress: z.string().optional(),
  shippingAddress: z.string().optional(),
  contactPerson: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  taxRegistrationId: z.string().optional(),
});

export const createInvoiceSchema = z.object({
  customerId: z.string().uuid("Select a customer"),
  currency: z.string().min(1).default("INR"),
  paymentTerms: z.enum(["Pay Advance", "Pay Later", "Letter of Credit", "50% Advance / 50% on Shipment"]).default("Pay Later"),
  advancePercent: z.coerce.number().min(0).max(100).default(0),
  exportDetails: exportDetailsSchema,
  requiredDocs: z.array(z.string()).default([]),
  items: z.array(itemSchema).min(1, "Add at least one line item"),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

// Same shape, everything optional — a PATCH only sends what actually
// changed. `items`, if present, REPLACES the whole line-item set rather
// than merging — simpler and safer than patching individual line items
// (see invoice.service.ts for why).
export const updateInvoiceSchema = createInvoiceSchema.partial();
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

export const updateInvoiceStatusSchema = z.object({
  status: z.enum(["Draft", "Submitted", "Processing", "Documents Pending", "Ready", "Completed", "Cancelled"]),
});
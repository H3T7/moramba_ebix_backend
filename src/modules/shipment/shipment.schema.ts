import { z } from "zod";

export const createShipmentSchema = z
  .object({
    invoiceId: z.string().uuid().optional(),
    billId: z.string().uuid().optional(),
    carrier: z.string().min(1, "Carrier is required"),
    trackingNumber: z.string().optional(),
    origin: z.string().min(1, "Origin is required"),
    destination: z.string().min(1, "Destination is required"),
    expectedDate: z.string().optional(),
  })
  .refine((data) => Boolean(data.invoiceId) !== Boolean(data.billId), {
    message: "Provide exactly one of invoiceId or billId",
    path: ["invoiceId"],
  });
export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;

export const updateShipmentSchema = z.object({
  carrier: z.string().min(1).optional(),
  trackingNumber: z.string().optional(),
  origin: z.string().min(1).optional(),
  destination: z.string().min(1).optional(),
  expectedDate: z.string().optional(),
  actualDate: z.string().optional(),
});
export type UpdateShipmentInput = z.infer<typeof updateShipmentSchema>;

export const updateShipmentStatusSchema = z.object({
  status: z.enum(["Preparing", "In Transit", "Customs", "Delivered", "Delayed", "Cancelled"]),
  note: z.string().optional(),
  location: z.string().optional(),
});

import { z } from "zod";

/**
 * Exactly one of invoiceId/billId, enforced here AND at the database level
 * (a CHECK constraint — see db/schema/payments.ts). Two layers on purpose:
 * zod gives a clean 400 with a readable message before we ever touch the
 * database; the CHECK constraint is what actually guarantees it, even
 * against a bug in this code or a direct SQL script run later.
 */
export const createPaymentSchema = z
  .object({
    invoiceId: z.string().uuid().optional(),
    billId: z.string().uuid().optional(),
    amount: z.coerce.number().positive("Amount must be greater than 0"),
    currency: z.string().min(1).default("INR"),
    paymentType: z.enum(["advance", "final"]),
    method: z.enum(["bank_transfer", "wire", "letter_of_credit", "cash", "other"]).default("bank_transfer"),
    transactionRef: z.string().optional(),
    paymentDate: z.string().min(1, "Payment date is required"),
    status: z.enum(["pending", "completed", "failed"]).default("completed"),
  })
  .refine((data) => Boolean(data.invoiceId) !== Boolean(data.billId), {
    message: "Provide exactly one of invoiceId or billId",
    path: ["invoiceId"],
  });
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const updatePaymentStatusSchema = z.object({
  status: z.enum(["pending", "completed", "failed"]),
});

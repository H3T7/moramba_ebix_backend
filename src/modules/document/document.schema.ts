import { z } from "zod";

export const uploadDocumentSchema = z
  .object({
    invoiceId: z.string().uuid().optional(),
    billId: z.string().uuid().optional(),
    category: z.enum(["product", "export", "import", "customs", "other"]).default("other"),
    country: z.string().optional(),
    fileName: z.string().min(1, "A file name is required"),
  })
  .refine((data) => Boolean(data.invoiceId) !== Boolean(data.billId), {
    message: "Provide exactly one of invoiceId or billId",
    path: ["invoiceId"],
  });
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

export const replaceDocumentSchema = z.object({
  fileName: z.string().min(1, "A file name is required"),
});

export const reviewDocumentSchema = z.object({
  decision: z.enum(["approve", "reject", "request_changes"]),
  comments: z.string().optional(),
  rejectionReason: z.string().optional(),
});
export type ReviewDocumentInput = z.infer<typeof reviewDocumentSchema>;

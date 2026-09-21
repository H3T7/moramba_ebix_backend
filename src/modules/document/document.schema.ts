import { z } from "zod";

/**
 * Uploads arrive as multipart/form-data, so every field here is a plain
 * STRING and a field the form left blank arrives as "" rather than being
 * absent. This turns "" into undefined so `.optional()` behaves the way it
 * does for JSON.
 */
const optionalText = z.preprocess((v) => (v === "" ? undefined : v), z.string().optional());
const optionalId = z.preprocess((v) => (v === "" ? undefined : v), z.string().uuid().optional());

/**
 * The FILE itself is not part of this schema — multer puts it on `req.file`
 * and the service validates it (type, size, non-empty). The file's name is
 * taken from the file, so there's no `fileName` field to send any more.
 */
export const uploadDocumentSchema = z
  .object({
    invoiceId: optionalId,
    billId: optionalId,
    category: z.enum(["product", "export", "import", "customs", "other"]).default("other"),
    docType: optionalText,
    description: optionalText,
    country: optionalText,
  })
  .refine((data) => Boolean(data.invoiceId) !== Boolean(data.billId), {
    message: "Provide exactly one of invoiceId or billId",
    path: ["invoiceId"],
  });
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

export const updateDocumentMetaSchema = z.object({
  docType: z.string().optional(),
  description: z.string().optional(),
});
export type UpdateDocumentMetaInput = z.infer<typeof updateDocumentMetaSchema>;

export const reviewDocumentSchema = z.object({
  decision: z.enum(["approve", "reject", "request_changes"]),
  comments: z.string().optional(),
  rejectionReason: z.string().optional(),
});
export type ReviewDocumentInput = z.infer<typeof reviewDocumentSchema>;

/** `?version=2` on the file route — which historical version to download. Omitted = the current one. */
export const fileQuerySchema = z.object({
  version: z.coerce.number().int().positive().optional(),
  download: z.enum(["1", "true"]).optional(),
});
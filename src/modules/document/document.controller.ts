import type { NextFunction, Request, Response } from "express";
import { uploadDocumentSchema, reviewDocumentSchema, updateDocumentMetaSchema, fileQuerySchema } from "./document.schema.js";
import {
  uploadDocument,
  listDocumentsByCompany,
  listDocumentsForTransaction,
  getDocument,
  getDocumentForVerifier,
  loadVerifierContext,
  getDocumentFile,
  replaceDocument,
  updateDocumentMeta,
  reviewDocument,
  startReview,
  deleteDocument,
  listVerifierQueue,
} from "./document.service.js";
import { AppError } from "../../middleware/errorHandler.js";
import { INLINE_SAFE_MIME_TYPES, contentDisposition } from "../../lib/fileStorage.js";

export async function upload(req: Request, res: Response) {
  // Multipart text fields arrive in req.body; the file itself is req.file
  // (both filled in by middleware/upload.ts before this runs).
  const input = uploadDocumentSchema.parse(req.body);
  // req.employee (the CALLER's own row at this company, resolved by
  // requireCompanyParamRole) — NOT req.user.sub, which is a userId, not
  // an employees.id. Passing the wrong one here would silently succeed
  // (both are just UUID strings, so TypeScript can't catch this) and
  // corrupt uploadedByEmployeeId with a value that isn't a real row in
  // the employees table at all.
  const doc = await uploadDocument(req.params.companyId as string, req.employee!.id, input, req.file);
  res.status(201).json(doc);
}

export async function list(req: Request, res: Response) {
  const rows = await listDocumentsByCompany(req.params.companyId as string);
  res.status(200).json(rows);
}

export async function listForTransaction(req: Request, res: Response) {
  const type = req.query.type as string;
  if (type !== "invoice" && type !== "bill") throw new AppError(400, "?type must be 'invoice' or 'bill'.");
  const rows = await listDocumentsForTransaction(type, req.params.transactionId as string);
  res.status(200).json(rows);
}

export async function getOne(req: Request, res: Response) {
  const doc = await getDocument(req.params.id as string);
  res.status(200).json(doc);
}

/**
 * GET /documents/:id/file[?version=N][&download=1] — streams the stored
 * file itself. Shared by the company route and the verifier route (each
 * guards it with its own auth middleware).
 *
 * Only PDFs and images are ever sent as `inline` (viewable in the
 * browser); every other type — and anything asked for with ?download=1 —
 * is sent as an `attachment`. That keeps a file like an .html or .svg from
 * ever being rendered as a live page.
 */
export async function file(req: Request, res: Response, next: NextFunction) {
  const { version, download } = fileQuerySchema.parse(req.query);
  // This handler serves both realms. On the verifier route `req.verifier` is set, and a
  // company verifier may only fetch files of their own company.
  const verifier = req.verifier ? await loadVerifierContext(req.verifier.sub) : undefined;
  const { dir, storedName, fileName, mimeType } = await getDocumentFile(req.params.id as string, version, verifier);

  const inline = INLINE_SAFE_MIME_TYPES.has(mimeType) && !download;
  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Disposition", contentDisposition(inline ? "inline" : "attachment", fileName));
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  res.sendFile(storedName, { root: dir, dotfiles: "allow" }, (err) => {
    if (err && !res.headersSent) next(err);
  });
}

/** Verifier-only: the same document detail plus its company and the invoice/bill it belongs to. */
export async function getOneForVerifier(req: Request, res: Response) {
  const ctx = await loadVerifierContext(req.verifier!.sub);
  const doc = await getDocumentForVerifier(req.params.id as string, ctx);
  res.status(200).json(doc);
}

export async function beginReview(req: Request, res: Response) {
  const ctx = await loadVerifierContext(req.verifier!.sub);
  const doc = await startReview(req.params.id as string, ctx);
  res.status(200).json(doc);
}

export async function replace(req: Request, res: Response) {
  const doc = await replaceDocument(req.params.id as string, req.employee!.id, req.file);
  res.status(200).json(doc);
}

export async function updateMeta(req: Request, res: Response) {
  const input = updateDocumentMetaSchema.parse(req.body);
  const doc = await updateDocumentMeta(req.params.id as string, input);
  res.status(200).json(doc);
}

export async function review(req: Request, res: Response) {
  const input = reviewDocumentSchema.parse(req.body);
  const ctx = await loadVerifierContext(req.verifier!.sub);
  const doc = await reviewDocument(req.params.id as string, ctx, input);
  res.status(200).json(doc);
}

export async function verifierQueue(req: Request, res: Response) {
  const status = req.query.status as string | undefined;
  const ctx = await loadVerifierContext(req.verifier!.sub);
  const rows = await listVerifierQueue(ctx, status);
  res.status(200).json(rows);
}

export async function remove(req: Request, res: Response) {
  const result = await deleteDocument(req.params.id as string);
  res.status(200).json(result);
}

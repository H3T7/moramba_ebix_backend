import type { Request, Response } from "express";
import { uploadDocumentSchema, replaceDocumentSchema, reviewDocumentSchema, updateDocumentMetaSchema } from "./document.schema.js";
import {
  uploadDocument,
  listDocumentsByCompany,
  listDocumentsForTransaction,
  getDocument,
  replaceDocument,
  updateDocumentMeta,
  reviewDocument,
  deleteDocument,
  listVerifierQueue,
} from "./document.service.js";
import { AppError } from "../../middleware/errorHandler.js";

export async function upload(req: Request, res: Response) {
  const input = uploadDocumentSchema.parse(req.body);
  // req.employee (the CALLER's own row at this company, resolved by
  // requireCompanyParamRole) — NOT req.user.sub, which is a userId, not
  // an employees.id. Passing the wrong one here would silently succeed
  // (both are just UUID strings, so TypeScript can't catch this) and
  // corrupt uploadedByEmployeeId with a value that isn't a real row in
  // the employees table at all.
  const doc = await uploadDocument(req.params.companyId as string, req.employee!.id, input);
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

export async function replace(req: Request, res: Response) {
  const { fileName } = replaceDocumentSchema.parse(req.body);
  const doc = await replaceDocument(req.params.id as string, req.employee!.id, fileName);
  res.status(200).json(doc);
}

export async function updateMeta(req: Request, res: Response) {
  const input = updateDocumentMetaSchema.parse(req.body);
  const doc = await updateDocumentMeta(req.params.id as string, input);
  res.status(200).json(doc);
}

export async function review(req: Request, res: Response) {
  const input = reviewDocumentSchema.parse(req.body);
  const doc = await reviewDocument(req.params.id as string, req.verifier!.sub, input);
  res.status(200).json(doc);
}

export async function verifierQueue(req: Request, res: Response) {
  const status = req.query.status as string | undefined;
  const rows = await listVerifierQueue(status);
  res.status(200).json(rows);
}

export async function remove(req: Request, res: Response) {
  const result = await deleteDocument(req.params.id as string);
  res.status(200).json(result);
}
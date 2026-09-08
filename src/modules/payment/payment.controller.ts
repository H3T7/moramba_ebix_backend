import type { Request, Response } from "express";
import { createPaymentSchema, updatePaymentStatusSchema } from "./payment.schema.js";
import {
  createPayment,
  listPaymentsByCompany,
  listPaymentsForTransaction,
  getPayment,
  updatePaymentStatus,
  deletePayment,
  getPaymentSummary,
} from "./payment.service.js";
import { AppError } from "../../middleware/errorHandler.js";

export async function create(req: Request, res: Response) {
  const input = createPaymentSchema.parse(req.body);
  const payment = await createPayment(req.params.companyId as string, input);
  res.status(201).json(payment);
}

export async function list(req: Request, res: Response) {
  const rows = await listPaymentsByCompany(req.params.companyId as string);
  res.status(200).json(rows);
}

export async function listForTransaction(req: Request, res: Response) {
  const type = req.query.type as string;
  if (type !== "invoice" && type !== "bill") throw new AppError(400, "?type must be 'invoice' or 'bill'.");
  const rows = await listPaymentsForTransaction(type, req.params.transactionId as string);
  res.status(200).json(rows);
}

export async function summaryForTransaction(req: Request, res: Response) {
  const type = req.query.type as string;
  if (type !== "invoice" && type !== "bill") throw new AppError(400, "?type must be 'invoice' or 'bill'.");
  const summary = await getPaymentSummary(type, req.params.transactionId as string);
  res.status(200).json(summary);
}

export async function getOne(req: Request, res: Response) {
  const payment = await getPayment(req.params.id as string);
  res.status(200).json(payment);
}

export async function updateStatus(req: Request, res: Response) {
  const { status } = updatePaymentStatusSchema.parse(req.body);
  const payment = await updatePaymentStatus(req.params.id as string, status);
  res.status(200).json(payment);
}

export async function remove(req: Request, res: Response) {
  const result = await deletePayment(req.params.id as string);
  res.status(200).json(result);
}

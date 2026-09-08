import type { Request, Response } from "express";
import { createInvoiceSchema, updateInvoiceSchema, updateInvoiceStatusSchema } from "./invoice.schema.js";
import { listInvoicesByCompany, getInvoice, createInvoice, updateInvoice, updateInvoiceStatus, submitInvoice, deleteInvoice } from "./invoice.service.js";

export async function list(req: Request, res: Response) {
  const rows = await listInvoicesByCompany(req.params.companyId as string);
  res.status(200).json(rows);
}

export async function getOne(req: Request, res: Response) {
  const invoice = await getInvoice(req.params.id as string);
  res.status(200).json(invoice);
}

export async function create(req: Request, res: Response) {
  const input = createInvoiceSchema.parse(req.body);
  const invoice = await createInvoice(req.params.companyId as string, input);
  res.status(201).json(invoice);
}

export async function update(req: Request, res: Response) {
  const input = updateInvoiceSchema.parse(req.body);
  const invoice = await updateInvoice(req.params.id as string, input);
  res.status(200).json(invoice);
}

export async function updateStatus(req: Request, res: Response) {
  const { status } = updateInvoiceStatusSchema.parse(req.body);
  const invoice = await updateInvoiceStatus(req.params.id as string, status);
  res.status(200).json(invoice);
}

export async function submit(req: Request, res: Response) {
  const invoice = await submitInvoice(req.params.id as string);
  res.status(200).json(invoice);
}

export async function remove(req: Request, res: Response) {
  const result = await deleteInvoice(req.params.id as string);
  res.status(200).json(result);
}

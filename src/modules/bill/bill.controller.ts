import type { Request, Response } from "express";
import { createBillSchema, updateBillSchema, updateBillStatusSchema } from "./bill.schema.js";
import { listBillsByCompany, getBill, createBill, updateBill, updateBillStatus, submitBill, deleteBill } from "./bill.service.js";

export async function list(req: Request, res: Response) {
  const rows = await listBillsByCompany(req.params.companyId as string);
  res.status(200).json(rows);
}

export async function getOne(req: Request, res: Response) {
  const bill = await getBill(req.params.id as string);
  res.status(200).json(bill);
}

export async function create(req: Request, res: Response) {
  const input = createBillSchema.parse(req.body);
  const bill = await createBill(req.params.companyId as string, input);
  res.status(201).json(bill);
}

export async function update(req: Request, res: Response) {
  const input = updateBillSchema.parse(req.body);
  const bill = await updateBill(req.params.id as string, input);
  res.status(200).json(bill);
}

export async function updateStatus(req: Request, res: Response) {
  const { status } = updateBillStatusSchema.parse(req.body);
  const bill = await updateBillStatus(req.params.id as string, status);
  res.status(200).json(bill);
}

export async function submit(req: Request, res: Response) {
  const bill = await submitBill(req.params.id as string);
  res.status(200).json(bill);
}

export async function remove(req: Request, res: Response) {
  const result = await deleteBill(req.params.id as string);
  res.status(200).json(result);
}

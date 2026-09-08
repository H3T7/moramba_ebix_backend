import type { Request, Response } from "express";
import { createCustomerSchema, updateCustomerSchema } from "./customer.schema.js";
import { listCustomersByCompany, getCustomer, createCustomer, updateCustomer, deleteCustomer } from "./customer.service.js";

export async function list(req: Request, res: Response) {
  const rows = await listCustomersByCompany(req.params.companyId as string);
  res.status(200).json(rows);
}

export async function getOne(req: Request, res: Response) {
  const customer = await getCustomer(req.params.id as string);
  res.status(200).json(customer);
}

export async function create(req: Request, res: Response) {
  const input = createCustomerSchema.parse(req.body);
  const customer = await createCustomer(req.params.companyId as string, input);
  res.status(201).json(customer);
}

export async function update(req: Request, res: Response) {
  const input = updateCustomerSchema.parse(req.body);
  const customer = await updateCustomer(req.params.id as string, input);
  res.status(200).json(customer);
}

export async function remove(req: Request, res: Response) {
  const result = await deleteCustomer(req.params.id as string);
  res.status(200).json(result);
}

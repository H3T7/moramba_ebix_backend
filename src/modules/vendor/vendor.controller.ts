import type { Request, Response } from "express";
import { createVendorSchema, updateVendorSchema } from "./vendor.schema.js";
import { listVendorsByCompany, getVendor, createVendor, updateVendor, deleteVendor } from "./vendor.service.js";

export async function list(req: Request, res: Response) {
  const rows = await listVendorsByCompany(req.params.companyId as string);
  res.status(200).json(rows);
}

export async function getOne(req: Request, res: Response) {
  const vendor = await getVendor(req.params.id as string);
  res.status(200).json(vendor);
}

export async function create(req: Request, res: Response) {
  const input = createVendorSchema.parse(req.body);
  const vendor = await createVendor(req.params.companyId as string, input);
  res.status(201).json(vendor);
}

export async function update(req: Request, res: Response) {
  const input = updateVendorSchema.parse(req.body);
  const vendor = await updateVendor(req.params.id as string, input);
  res.status(200).json(vendor);
}

export async function remove(req: Request, res: Response) {
  const result = await deleteVendor(req.params.id as string);
  res.status(200).json(result);
}

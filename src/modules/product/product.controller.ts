import type { Request, Response } from "express";
import { createProductSchema, updateProductSchema } from "./product.schema.js";
import { listProductsByCompany, getProduct, createProduct, updateProduct, deleteProduct } from "./product.service.js";

export async function list(req: Request, res: Response) {
  const rows = await listProductsByCompany(req.params.companyId as string);
  res.status(200).json(rows);
}

export async function getOne(req: Request, res: Response) {
  const product = await getProduct(req.params.id as string);
  res.status(200).json(product);
}

export async function create(req: Request, res: Response) {
  const input = createProductSchema.parse(req.body);
  const product = await createProduct(req.params.companyId as string, input);
  res.status(201).json(product);
}

export async function update(req: Request, res: Response) {
  const input = updateProductSchema.parse(req.body);
  const product = await updateProduct(req.params.id as string, input);
  res.status(200).json(product);
}

export async function remove(req: Request, res: Response) {
  const result = await deleteProduct(req.params.id as string);
  res.status(200).json(result);
}

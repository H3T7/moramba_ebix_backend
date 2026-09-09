import { prisma } from "../../db/client.js";
import { AppError } from "../../middleware/errorHandler.js";
import type { CreateProductInput, UpdateProductInput } from "./product.schema.js";

export async function listProductsByCompany(companyId: string) {
  return prisma.product.findMany({ where: { companyId } });
}

export async function getProduct(id: string) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new AppError(404, "Product not found.");
  return product;
}

export async function createProduct(companyId: string, input: CreateProductInput) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError(404, "That company doesn't exist.");

  return prisma.product.create({ data: { ...input, companyId } });
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  const updated = await prisma.product.update({ where: { id }, data: input }).catch(() => null);
  if (!updated) throw new AppError(404, "Product not found.");
  return updated;
}

export async function deleteProduct(id: string) {
  const deleted = await prisma.product.delete({ where: { id } }).catch(() => null);
  if (!deleted) throw new AppError(404, "Product not found.");
  return { id: deleted.id };
}

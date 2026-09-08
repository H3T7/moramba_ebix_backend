import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { products, companies } from "../../db/schema/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import type { CreateProductInput, UpdateProductInput } from "./product.schema.js";

export async function listProductsByCompany(companyId: string) {
  return db.select().from(products).where(eq(products.companyId, companyId));
}

export async function getProduct(id: string) {
  const product = await db.query.products.findFirst({ where: eq(products.id, id) });
  if (!product) throw new AppError(404, "Product not found.");
  return product;
}

export async function createProduct(companyId: string, input: CreateProductInput) {
  const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
  if (!company) throw new AppError(404, "That company doesn't exist.");

  const [created] = await db.insert(products).values({ ...input, companyId }).returning();
  return created;
}

export async function updateProduct(id: string, input: UpdateProductInput) {
  const [updated] = await db.update(products).set(input).where(eq(products.id, id)).returning();
  if (!updated) throw new AppError(404, "Product not found.");
  return updated;
}

export async function deleteProduct(id: string) {
  const [deleted] = await db.delete(products).where(eq(products.id, id)).returning();
  if (!deleted) throw new AppError(404, "Product not found.");
  return { id: deleted.id };
}

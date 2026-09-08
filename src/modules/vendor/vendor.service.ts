import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { vendors, companies } from "../../db/schema/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import type { CreateVendorInput, UpdateVendorInput } from "./vendor.schema.js";

export async function listVendorsByCompany(companyId: string) {
  return db.select().from(vendors).where(eq(vendors.companyId, companyId));
}

export async function getVendor(id: string) {
  const vendor = await db.query.vendors.findFirst({ where: eq(vendors.id, id) });
  if (!vendor) throw new AppError(404, "Vendor not found.");
  return vendor;
}

export async function createVendor(companyId: string, input: CreateVendorInput) {
  const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
  if (!company) throw new AppError(404, "That company doesn't exist.");

  const [created] = await db.insert(vendors).values({ ...input, companyId }).returning();
  return created;
}

export async function updateVendor(id: string, input: UpdateVendorInput) {
  const [updated] = await db.update(vendors).set(input).where(eq(vendors.id, id)).returning();
  if (!updated) throw new AppError(404, "Vendor not found.");
  return updated;
}

export async function deleteVendor(id: string) {
  const [deleted] = await db.delete(vendors).where(eq(vendors.id, id)).returning();
  if (!deleted) throw new AppError(404, "Vendor not found.");
  return { id: deleted.id };
}

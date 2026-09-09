import { prisma } from "../../db/client.js";
import { AppError } from "../../middleware/errorHandler.js";
import type { CreateVendorInput, UpdateVendorInput } from "./vendor.schema.js";

export async function listVendorsByCompany(companyId: string) {
  return prisma.vendor.findMany({ where: { companyId } });
}

export async function getVendor(id: string) {
  const vendor = await prisma.vendor.findUnique({ where: { id } });
  if (!vendor) throw new AppError(404, "Vendor not found.");
  return vendor;
}

export async function createVendor(companyId: string, input: CreateVendorInput) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError(404, "That company doesn't exist.");

  return prisma.vendor.create({ data: { ...input, companyId } });
}

export async function updateVendor(id: string, input: UpdateVendorInput) {
  const updated = await prisma.vendor.update({ where: { id }, data: input }).catch(() => null);
  if (!updated) throw new AppError(404, "Vendor not found.");
  return updated;
}

export async function deleteVendor(id: string) {
  const deleted = await prisma.vendor.delete({ where: { id } }).catch(() => null);
  if (!deleted) throw new AppError(404, "Vendor not found.");
  return { id: deleted.id };
}

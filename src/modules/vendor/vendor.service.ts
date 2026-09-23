import { Prisma } from "@prisma/client";
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

/** Same rule and reasoning as customer.service.ts's assertEmailNotTaken. */
async function assertEmailNotTaken(companyId: string, email: string, excludeId?: string) {
  const existing = await prisma.vendor.findFirst({
    where: { companyId, email: { equals: email, mode: "insensitive" }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, name: true },
  });
  if (existing) {
    throw new AppError(409, `A vendor with this email already exists for this company (${existing.name}).`);
  }
}

export async function createVendor(companyId: string, input: CreateVendorInput) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError(404, "That company doesn't exist.");
  await assertEmailNotTaken(companyId, input.email);

  try {
    return await prisma.vendor.create({ data: { ...input, companyId } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new AppError(409, "A vendor with this email already exists for this company.");
    }
    throw err;
  }
}

export async function updateVendor(id: string, input: UpdateVendorInput) {
  if (input.email) {
    const current = await prisma.vendor.findUnique({ where: { id }, select: { companyId: true } });
    if (!current) throw new AppError(404, "Vendor not found.");
    await assertEmailNotTaken(current.companyId, input.email, id);
  }
  const updated = await prisma.vendor
    .update({ where: { id }, data: input })
    .catch((err) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new AppError(409, "A vendor with this email already exists for this company.");
      }
      return null;
    });
  if (!updated) throw new AppError(404, "Vendor not found.");
  return updated;
}

export async function deleteVendor(id: string) {
  const deleted = await prisma.vendor.delete({ where: { id } }).catch(() => null);
  if (!deleted) throw new AppError(404, "Vendor not found.");
  return { id: deleted.id };
}

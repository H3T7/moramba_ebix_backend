import { Prisma } from "@prisma/client";
import { prisma } from "../../db/client.js";
import { AppError } from "../../middleware/errorHandler.js";
import type { CreateCustomerInput, UpdateCustomerInput } from "./customer.schema.js";

export async function listCustomersByCompany(companyId: string) {
  return prisma.customer.findMany({ where: { companyId } });
}

export async function getCustomer(id: string) {
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) throw new AppError(404, "Customer not found.");
  return customer;
}

/**
 * Case-insensitive: "buyer@acme.com" and "Buyer@Acme.com" collide, so a typo
 * in capitalization can't create a silent duplicate. Excludes `excludeId` so
 * an update can keep a record's own email. Backed by a matching DB-level
 * index (see prisma/schema.prisma's comment on Customer) for the rare race
 * where two requests land at the same instant — this check is what turns
 * that into a clear message instead of a raw database error.
 */
async function assertEmailNotTaken(companyId: string, email: string, excludeId?: string) {
  const existing = await prisma.customer.findFirst({
    where: { companyId, email: { equals: email, mode: "insensitive" }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, name: true },
  });
  if (existing) {
    throw new AppError(409, `A customer with this email already exists for this company (${existing.name}).`);
  }
}

export async function createCustomer(companyId: string, input: CreateCustomerInput) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError(404, "That company doesn't exist.");
  await assertEmailNotTaken(companyId, input.email);

  try {
    return await prisma.customer.create({ data: { ...input, companyId } });
  } catch (err) {
    // Only reached if two requests raced past the check above at the same instant.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new AppError(409, "A customer with this email already exists for this company.");
    }
    throw err;
  }
}

export async function updateCustomer(id: string, input: UpdateCustomerInput) {
  if (input.email) {
    const current = await prisma.customer.findUnique({ where: { id }, select: { companyId: true } });
    if (!current) throw new AppError(404, "Customer not found.");
    await assertEmailNotTaken(current.companyId, input.email, id);
  }
  const updated = await prisma.customer
    .update({ where: { id }, data: input })
    .catch((err) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new AppError(409, "A customer with this email already exists for this company.");
      }
      return null;
    });
  if (!updated) throw new AppError(404, "Customer not found.");
  return updated;
}

export async function deleteCustomer(id: string) {
  const deleted = await prisma.customer.delete({ where: { id } }).catch(() => null);
  if (!deleted) throw new AppError(404, "Customer not found.");
  return { id: deleted.id };
}

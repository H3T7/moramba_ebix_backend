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

export async function createCustomer(companyId: string, input: CreateCustomerInput) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError(404, "That company doesn't exist.");

  return prisma.customer.create({ data: { ...input, companyId } });
}

export async function updateCustomer(id: string, input: UpdateCustomerInput) {
  const updated = await prisma.customer.update({ where: { id }, data: input }).catch(() => null);
  if (!updated) throw new AppError(404, "Customer not found.");
  return updated;
}

export async function deleteCustomer(id: string) {
  const deleted = await prisma.customer.delete({ where: { id } }).catch(() => null);
  if (!deleted) throw new AppError(404, "Customer not found.");
  return { id: deleted.id };
}

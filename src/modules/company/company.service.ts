import { prisma } from "../../db/client.js";
import { AppError } from "../../middleware/errorHandler.js";
import type { CreateCompanyInput } from "./company.schema.js";

/**
 * Whoever creates a company automatically becomes its Owner — a real
 * `employees` row (userId=creator, companyId=this new company, role=
 * "owner") is created in the SAME transaction as the company itself, so
 * it's never possible to end up with a company that has no owner.
 */
export async function createCompany(creatorUserId: string, input: CreateCompanyInput) {
  return prisma.$transaction(async (tx) => {
    const company = await tx.company.create({ data: input });
    const employee = await tx.employee.create({ data: { userId: creatorUserId, companyId: company.id, role: "owner" } });
    return { company, employee };
  });
}

export async function listCompanies() {
  return prisma.company.findMany();
}

export async function getCompanyById(id: string) {
  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) throw new AppError(404, "Company not found.");
  return company;
}

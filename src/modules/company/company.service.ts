import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { companies } from "../../db/schema/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import type { CreateCompanyInput } from "./company.schema.js";

export async function createCompany(input: CreateCompanyInput) {
  const [created] = await db.insert(companies).values(input).returning();
  return created;
}

export async function listCompanies() {
  return db.select().from(companies);
}

export async function getCompanyById(id: string) {
  const company = await db.query.companies.findFirst({ where: eq(companies.id, id) });
  if (!company) throw new AppError(404, "Company not found.");
  return company;
}

import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { customers, companies } from "../../db/schema/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import type { CreateCustomerInput, UpdateCustomerInput } from "./customer.schema.js";

export async function listCustomersByCompany(companyId: string) {
  return db.select().from(customers).where(eq(customers.companyId, companyId));
}

export async function getCustomer(id: string) {
  const customer = await db.query.customers.findFirst({ where: eq(customers.id, id) });
  if (!customer) throw new AppError(404, "Customer not found.");
  return customer;
}

export async function createCustomer(companyId: string, input: CreateCustomerInput) {
  const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
  if (!company) throw new AppError(404, "That company doesn't exist.");

  const [created] = await db.insert(customers).values({ ...input, companyId }).returning();
  return created;
}

export async function updateCustomer(id: string, input: UpdateCustomerInput) {
  const [updated] = await db.update(customers).set(input).where(eq(customers.id, id)).returning();
  if (!updated) throw new AppError(404, "Customer not found.");
  return updated;
}

export async function deleteCustomer(id: string) {
  const [deleted] = await db.delete(customers).where(eq(customers.id, id)).returning();
  if (!deleted) throw new AppError(404, "Customer not found.");
  return { id: deleted.id };
}

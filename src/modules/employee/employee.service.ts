import { eq, and, ne } from "drizzle-orm";
import { db } from "../../db/client.js";
import { employees, employeeCompanies, companies } from "../../db/schema/index.js";
import { hashPassword } from "../../lib/password.js";
import { AppError } from "../../middleware/errorHandler.js";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "./employee.schema.js";

// Same idea as auth.service.ts — never let a passwordHash leak into an API response.
function toPublicEmployee(row: typeof employees.$inferSelect) {
  const { passwordHash, ...safe } = row;
  return safe;
}

export async function listEmployeesByCompany(companyId: string) {
  const rows = await db.select().from(employees).where(eq(employees.companyId, companyId));
  return rows.map(toPublicEmployee);
}

export async function getEmployee(id: string) {
  const employee = await db.query.employees.findFirst({ where: eq(employees.id, id) });
  if (!employee) throw new AppError(404, "Employee not found.");
  return toPublicEmployee(employee);
}

export async function createEmployee(companyId: string, input: CreateEmployeeInput) {
  const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
  if (!company) throw new AppError(404, "That company doesn't exist.");

  const existing = await db.query.employees.findFirst({ where: eq(employees.email, input.email) });
  if (existing) throw new AppError(409, "An account with that email already exists.");

  const passwordHash = await hashPassword(input.password);
  const { password: _password, ...rest } = input;

  const [created] = await db
    .insert(employees)
    .values({ ...rest, companyId, passwordHash })
    .returning();

  // New employees automatically get access to the company they were hired
  // into — same rule as self-registration in auth.service.ts.
  await db.insert(employeeCompanies).values({ employeeId: created.id, companyId });

  return toPublicEmployee(created);
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput) {
  const existing = await db.query.employees.findFirst({ where: eq(employees.id, id) });
  if (!existing) throw new AppError(404, "Employee not found.");

  if (input.email && input.email !== existing.email) {
    // ne() = "not equal" — make sure no OTHER employee already has this
    // email before we let this one change to it.
    const clash = await db.query.employees.findFirst({
      where: and(eq(employees.email, input.email), ne(employees.id, id)),
    });
    if (clash) throw new AppError(409, "Another account already uses that email.");
  }

  const [updated] = await db.update(employees).set(input).where(eq(employees.id, id)).returning();
  return toPublicEmployee(updated);
}

export async function updateEmployeeStatus(id: string, status: "active" | "inactive") {
  const [updated] = await db.update(employees).set({ status }).where(eq(employees.id, id)).returning();
  if (!updated) throw new AppError(404, "Employee not found.");
  return toPublicEmployee(updated);
}

export async function updateEmployeeRole(id: string, role: "admin" | "hr" | "accountant" | "employee") {
  const [updated] = await db.update(employees).set({ role }).where(eq(employees.id, id)).returning();
  if (!updated) throw new AppError(404, "Employee not found.");
  return toPublicEmployee(updated);
}

export async function deleteEmployee(id: string) {
  const [deleted] = await db.delete(employees).where(eq(employees.id, id)).returning();
  if (!deleted) throw new AppError(404, "Employee not found.");
  return { id: deleted.id };
}

import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { companies, employeeCompanies, employees } from "../../db/schema/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import type { CreateCompanyInput } from "./company.schema.js";

/**
 * Whoever creates a company automatically becomes its Owner — a real
 * membership row is created in the SAME transaction as the company itself,
 * so it's never possible to end up with a company that has no owner. If
 * this is the creator's very first company, their "home" employee record
 * (companyId, previously null — see employees.ts) is backfilled too, same
 * rule as accepting an invitation for the first time.
 *
 * `employees.role` is a SEPARATE field from the membership role above —
 * it's the global RBAC role (admin/hr/accountant/employee) the frontend's
 * sidebar and permission checks actually read. A brand-new account
 * defaults to "employee" there (see auth.schema.ts), which meant someone
 * could become the real Owner of a company and still only see the
 * bare-minimum "Employee" sidebar — Owner and "employee" RBAC role are two
 * different systems that were never connected. Fixed here, but ONLY when
 * this is their first company (the same `!creator.companyId` check as the
 * backfill above): someone who already has an established role at another
 * company (say, "hr") must never get silently upgraded to "admin"
 * everywhere just because they created a second, unrelated company.
 */
export async function createCompany(creatorEmployeeId: string, input: CreateCompanyInput) {
  return db.transaction(async (tx) => {
    const [created] = await tx.insert(companies).values(input).returning();

    await tx.insert(employeeCompanies).values({ employeeId: creatorEmployeeId, companyId: created.id, role: "owner", status: "active" });

    const creator = await tx.query.employees.findFirst({ where: eq(employees.id, creatorEmployeeId) });
    let updatedEmployee = creator;
    if (creator && !creator.companyId) {
      const [updated] = await tx
        .update(employees)
        .set({ companyId: created.id, role: "admin" })
        .where(eq(employees.id, creatorEmployeeId))
        .returning();
      updatedEmployee = updated;
    }

    return { company: created, employee: updatedEmployee };
  });
}

export async function listCompanies() {
  return db.select().from(companies);
}

export async function getCompanyById(id: string) {
  const company = await db.query.companies.findFirst({ where: eq(companies.id, id) });
  if (!company) throw new AppError(404, "Company not found.");
  return company;
}

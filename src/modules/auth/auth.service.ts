import { eq, and } from "drizzle-orm";
import { db } from "../../db/client.js";
import { employees, employeeCompanies, companies } from "../../db/schema/index.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { signEmployeeToken } from "../../lib/jwt.js";
import { AppError } from "../../middleware/errorHandler.js";
import type { RegisterInput, LoginInput } from "./auth.schema.js";

/**
 * WHY A "SERVICE LAYER" AT ALL?
 * -------------------------------
 * We could put this logic directly in the route handler, and for a tiny
 * app that'd be fine. But keeping it separate means:
 *   - This code has zero idea what Express is — it just takes plain data
 *     in and returns plain data out. That makes it trivial to unit test.
 *   - If we ever add a second way to trigger this (a CLI script, a
 *     background job, a GraphQL API), we reuse this function unchanged.
 *   - The controller (auth.controller.ts) stays tiny and readable: its
 *     only job is "parse the request, call the service, send the response."
 */

// Fields we NEVER want to accidentally send back to the client.
function toPublicEmployee(row: typeof employees.$inferSelect) {
  const { passwordHash, ...safe } = row;
  return safe;
}

export async function registerEmployee(input: RegisterInput) {
  // Emails are stored and matched case-insensitively EVERYWHERE in this
  // app (register, login, invitations) — normalizing to lowercase at the
  // one point data gets written is what makes that actually true, rather
  // than relying on every future query to remember to lowercase both
  // sides. Without this, "John@Example.com" (typed by an Admin sending an
  // invitation) and "john@example.com" (typed by John registering) would
  // silently be treated as two different people.
  const email = input.email.toLowerCase();

  const existing = await db.query.employees.findFirst({ where: eq(employees.email, email) });
  if (existing) {
    throw new AppError(409, "An account with that email already exists.");
  }

  // companyId is optional — "User account != Company membership." Someone
  // can register with none of the company-specific fields at all and end
  // up with a real account that has zero companies, exactly like a person
  // who signs up before anyone has invited them anywhere.
  if (input.companyId) {
    const company = await db.query.companies.findFirst({ where: eq(companies.id, input.companyId) });
    if (!company) throw new AppError(404, "That company doesn't exist.");
  }

  const passwordHash = await hashPassword(input.password);

  const [created] = await db
    .insert(employees)
    .values({
      companyId: input.companyId,
      employeeCode: input.employeeCode,
      firstName: input.firstName,
      lastName: input.lastName,
      email,
      passwordHash,
      phone: input.phone,
      department: input.department,
      designation: input.designation,
      dateOfJoining: input.dateOfJoining,
      role: input.role,
    })
    .returning();

  // Only create a membership if a company was actually provided.
  if (input.companyId) {
    await db.insert(employeeCompanies).values({ employeeId: created.id, companyId: input.companyId, role: "employee" });
  }

  const token = signEmployeeToken({ sub: created.id, role: created.role, type: "employee" });

  return { token, employee: toPublicEmployee(created) };
}

export async function loginEmployee(input: LoginInput) {
  const email = input.email.toLowerCase();
  const employee = await db.query.employees.findFirst({ where: eq(employees.email, email) });

  // Deliberately the SAME error message whether the email doesn't exist or
  // the password is wrong. If we said "no account with that email" for one
  // case and "wrong password" for the other, an attacker could use that
  // difference to figure out which emails are registered — that's called
  // a "user enumeration" vulnerability.
  const invalid = () => new AppError(401, "Invalid email or password.");

  if (!employee) throw invalid();

  const passwordOk = await verifyPassword(input.password, employee.passwordHash);
  if (!passwordOk) throw invalid();

  if (employee.status === "inactive") {
    throw new AppError(403, "This account has been deactivated.");
  }

  const token = signEmployeeToken({ sub: employee.id, role: employee.role, type: "employee" });
  const accessibleCompanies = await getAccessibleCompanies(employee.id);

  return { token, employee: toPublicEmployee(employee), accessibleCompanies };
}

export async function getEmployeeById(id: string) {
  const employee = await db.query.employees.findFirst({ where: eq(employees.id, id) });
  if (!employee) throw new AppError(404, "Employee not found.");

  const accessibleCompanies = await getAccessibleCompanies(id);
  return { employee: toPublicEmployee(employee), accessibleCompanies };
}

// Only ACTIVE memberships count as "accessible" — suspended/removed ones
// don't, even though the row still exists (see employeeCompanies.ts on why
// membership status is tracked instead of just deleting the row). Each
// company comes back with the employee's OWN role at that specific
// company attached, since it can differ company to company.
async function getAccessibleCompanies(employeeId: string) {
  const rows = await db
    .select({ company: companies, role: employeeCompanies.role })
    .from(employeeCompanies)
    .innerJoin(companies, eq(employeeCompanies.companyId, companies.id))
    .where(and(eq(employeeCompanies.employeeId, employeeId), eq(employeeCompanies.status, "active")));

  return rows.map((r) => ({ ...r.company, role: r.role }));
}

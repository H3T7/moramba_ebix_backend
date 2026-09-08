import { pgTable, uuid, timestamp, pgEnum, unique } from "drizzle-orm/pg-core";
import { employees } from "./employees.js";
import { companies } from "./companies.js";

/**
 * Membership role is DELIBERATELY separate from `employees.role` — that
 * column is used for JWT/auth claims and the 4-value RBAC system elsewhere
 * in this API; a membership role is "what job function does this person
 * hold AT THIS SPECIFIC COMPANY," which can be a wider set (Owner,
 * Operations, Verifier, Viewer...) and can be DIFFERENT at every company
 * the same person belongs to.
 */
export const membershipRoleEnum = pgEnum("membership_role", [
  "owner",
  "admin",
  "hr",
  "accountant",
  "operations",
  "verifier",
  "viewer",
  "employee",
]);

/**
 * Membership STATUS is a completely separate state machine from Invitation
 * status (see invitations.ts). An invitation resolves once and stops
 * changing; membership keeps changing for as long as someone is associated
 * with a company at all: active <-> suspended, or -> removed.
 */
export const membershipStatusEnum = pgEnum("membership_status", ["active", "suspended", "removed"]);

/**
 * A "join table" (a.k.a. junction table) — the standard relational way to
 * model many-to-many relationships. One employee can belong to many
 * companies, and one company can have many employees, each pair carrying
 * its OWN role and status — this is what makes "Owner at Company A,
 * Operations at Company B" for the same person actually representable.
 */
export const employeeCompanies = pgTable(
  "employee_companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    role: membershipRoleEnum("role").notNull().default("employee"),
    status: membershipStatusEnum("status").notNull().default("active"),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [unique("employee_company_unique").on(table.employeeId, table.companyId)]
);

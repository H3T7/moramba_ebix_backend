import { pgTable, uuid, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { employees } from "./employees.js";
import { membershipRoleEnum } from "./employeeCompanies.js";

/**
 * Invitation STATUS is its own state machine, deliberately separate from
 * membership status (see employeeCompanies.ts):
 *
 *   pending -> accepted   (a membership row is created — see invitation.service.ts)
 *   pending -> rejected   (no membership is ever created)
 *   pending -> expired    (the window passed with no response)
 *   pending -> cancelled  (an Admin pulled it back before it was answered)
 *
 * Once an invitation leaves "pending" it never changes again.
 */
export const invitationStatusEnum = pgEnum("invitation_status", ["pending", "accepted", "rejected", "expired", "cancelled"]);

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),

  email: text("email").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: membershipRoleEnum("role").notNull(),
  department: text("department"),
  designation: text("designation"),
  phone: text("phone"),

  // Nullable: at invite time we don't require the person to already have a
  // Moramba account — see invitation.service.ts for how a brand-new email
  // is handled differently from an existing one at CREATE time, and how
  // ACCEPT resolves either case.
  invitedEmployeeId: uuid("invited_employee_id").references(() => employees.id, { onDelete: "set null" }),
  invitedByEmployeeId: uuid("invited_by_employee_id").notNull().references(() => employees.id),

  status: invitationStatusEnum("status").notNull().default("pending"),
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

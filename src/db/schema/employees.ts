import { pgTable, text, timestamp, uuid, pgEnum, date } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

/**
 * A Postgres ENUM is a column type restricted to a fixed list of values —
 * the database itself will reject "SuperAdmin" if only these four exist.
 * This is stronger than just checking the value in application code: it's
 * enforced no matter what inserts the row.
 */
export const roleEnum = pgEnum("role", ["admin", "hr", "accountant", "employee"]);
export const employmentTypeEnum = pgEnum("employment_type", ["Full-time", "Part-time", "Contract"]);
export const employeeStatusEnum = pgEnum("employee_status", ["active", "inactive"]);

/**
 * Employees double as the company workspace's login users — every employee
 * who should be able to sign in has a passwordHash here.
 *
 * `companyId` is nullable on purpose: "User account ≠ Company membership."
 * Someone can self-register (POST /api/auth/register with no companyId)
 * and hold a real Moramba account with zero companies — they only gain
 * access to one by accepting an invitation (see invitations.ts), at which
 * point `companyId` is backfilled as their "home" company if it was empty.
 * `employeeCode`, `department`, `designation` and `dateOfJoining` are
 * company-specific HR fields, so they're nullable for the same reason —
 * a bare account has none of them yet.
 *
 * Multi-company ACCESS (which companies a user can switch between, and
 * their role/status at EACH one) is the separate `employee_companies`
 * join table — one person can be Owner at one company and Operations at
 * another, which a single `role` column here could never express.
 */
export const employees = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),

  employeeCode: text("employee_code"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),

  phone: text("phone"),
  dob: date("dob"),
  gender: text("gender"),
  address: text("address"),

  department: text("department"),
  designation: text("designation"),
  role: roleEnum("role").notNull().default("employee"),
  dateOfJoining: date("date_of_joining"),
  employmentType: employmentTypeEnum("employment_type").notNull().default("Full-time"),
  status: employeeStatusEnum("status").notNull().default("active"),

  paymentMode: text("payment_mode").notNull().default("bank"),
  bankAccountNumber: text("bank_account_number"),
  bankIfsc: text("bank_ifsc"),
  bankName: text("bank_name"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

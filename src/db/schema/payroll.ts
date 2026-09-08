import { pgTable, uuid, numeric, date, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { employees } from "./employees.js";

export const payrollRunStatusEnum = pgEnum("payroll_run_status", ["Pending", "Processing", "Completed"]);
export const payrollEntryStatusEnum = pgEnum("payroll_entry_status", ["Pending", "Processed", "Paid"]);

/**
 * One row per salary change, not one row per employee — `effectiveFrom`
 * means a raise doesn't overwrite history, it adds a new row. Payroll run
 * generation (see payroll.service.ts) always uses whichever structure's
 * `effectiveFrom` is the most recent one on or before the run's month.
 */
export const salaryStructures = pgTable("salary_structures", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),

  basic: numeric("basic", { precision: 12, scale: 2 }).notNull(),
  hra: numeric("hra", { precision: 12, scale: 2 }).notNull().default("0"),
  conveyance: numeric("conveyance", { precision: 12, scale: 2 }).notNull().default("0"),
  medical: numeric("medical", { precision: 12, scale: 2 }).notNull().default("0"),
  special: numeric("special", { precision: 12, scale: 2 }).notNull().default("0"),
  deductions: numeric("deductions", { precision: 12, scale: 2 }).notNull().default("0"),

  effectiveFrom: date("effective_from").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** One payroll run per company per month — e.g. "Aurelia Textiles, September 2026." */
export const payrollRuns = pgTable("payroll_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  month: text("month").notNull(), // "YYYY-MM"
  status: payrollRunStatusEnum("status").notNull().default("Pending"),
  generatedByEmployeeId: uuid("generated_by_employee_id").notNull().references(() => employees.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * A frozen snapshot of one employee's pay for one run — deliberately
 * copies the salary numbers at generation time rather than pointing back
 * at salary_structures, so a later raise never silently rewrites what a
 * past payslip says was paid.
 */
export const payrollEntries = pgTable("payroll_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  payrollRunId: uuid("payroll_run_id").notNull().references(() => payrollRuns.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id").notNull().references(() => employees.id),

  basic: numeric("basic", { precision: 12, scale: 2 }).notNull(),
  hra: numeric("hra", { precision: 12, scale: 2 }).notNull(),
  conveyance: numeric("conveyance", { precision: 12, scale: 2 }).notNull(),
  medical: numeric("medical", { precision: 12, scale: 2 }).notNull(),
  special: numeric("special", { precision: 12, scale: 2 }).notNull(),
  grossPay: numeric("gross_pay", { precision: 12, scale: 2 }).notNull(),
  deductions: numeric("deductions", { precision: 12, scale: 2 }).notNull(),
  netPay: numeric("net_pay", { precision: 12, scale: 2 }).notNull(),

  status: payrollEntryStatusEnum("status").notNull().default("Pending"),
  paidAt: timestamp("paid_at"),
});

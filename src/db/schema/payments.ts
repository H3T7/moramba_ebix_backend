import { pgTable, uuid, numeric, text, date, timestamp, pgEnum, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";
import { invoices } from "./invoices.js";
import { bills } from "./bills.js";

export const paymentTypeEnum = pgEnum("payment_type", ["advance", "final"]);
export const paymentMethodEnum = pgEnum("payment_method", ["bank_transfer", "wire", "letter_of_credit", "cash", "other"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "completed", "failed"]);

/**
 * A payment belongs to EXACTLY ONE of an invoice or a bill — never both,
 * never neither. Rather than a loose polymorphic reference (a
 * "transactionType" string + a bare id column with no real foreign key,
 * which the database could never enforce), this uses two nullable real
 * foreign keys and a CHECK constraint that only one is set. Postgres
 * itself now rejects a payment record that doesn't make sense, instead of
 * relying purely on application code to remember the rule every time.
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }),
    billId: uuid("bill_id").references(() => bills.id, { onDelete: "cascade" }),

    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("INR"),
    paymentType: paymentTypeEnum("payment_type").notNull(),
    method: paymentMethodEnum("method").notNull().default("bank_transfer"),
    transactionRef: text("transaction_ref"),
    paymentDate: date("payment_date").notNull(),
    status: paymentStatusEnum("status").notNull().default("completed"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "payment_exactly_one_parent",
      sql`(${table.invoiceId} is not null and ${table.billId} is null) or (${table.invoiceId} is null and ${table.billId} is not null)`
    ),
  ]
);

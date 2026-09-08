import { pgTable, uuid, text, integer, timestamp, pgEnum, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";
import { invoices } from "./invoices.js";
import { bills } from "./bills.js";
import { employees } from "./employees.js";
import { verifiers } from "./verifiers.js";

export const documentCategoryEnum = pgEnum("document_category", ["product", "export", "import", "customs", "other"]);

export const documentStatusEnum = pgEnum("document_status", [
  "Pending Verification",
  "Under Review",
  "Verified",
  "Rejected",
  "Requires Changes",
]);

/**
 * Same "exactly one parent" rule as Payments (see payments.ts) — a
 * document belongs to one invoice or one bill, enforced with a real
 * Postgres CHECK constraint, not just application code.
 */
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }),
    billId: uuid("bill_id").references(() => bills.id, { onDelete: "cascade" }),

    category: documentCategoryEnum("category").notNull().default("other"),
    country: text("country"),

    // The CURRENT version's filename + who uploaded it — full history of
    // every prior version lives in document_versions below. Replacing a
    // document bumps `version` and resets status back to "Pending
    // Verification"; the old file is never deleted, just superseded.
    fileName: text("file_name").notNull(),
    version: integer("version").notNull().default(1),
    uploadedByEmployeeId: uuid("uploaded_by_employee_id").notNull().references(() => employees.id),

    status: documentStatusEnum("status").notNull().default("Pending Verification"),
    // Reviews are done by a Verifier (a completely separate identity realm
    // from employees, see verifiers.ts) — this is why it's a distinct
    // column from uploadedByEmployeeId above, not the same FK reused.
    reviewerVerifierId: uuid("reviewer_verifier_id").references(() => verifiers.id),
    reviewerComments: text("reviewer_comments"),
    rejectionReason: text("rejection_reason"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "document_exactly_one_parent",
      sql`(${table.invoiceId} is not null and ${table.billId} is null) or (${table.invoiceId} is null and ${table.billId} is not null)`
    ),
  ]
);

/** Append-only — a row is added on upload and on every replace, never edited or deleted. */
export const documentVersions = pgTable("document_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  fileName: text("file_name").notNull(),
  uploadedByEmployeeId: uuid("uploaded_by_employee_id").notNull().references(() => employees.id),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

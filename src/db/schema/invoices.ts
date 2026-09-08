import { pgTable, text, timestamp, uuid, numeric, integer, boolean, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { customers } from "./customers.js";

/**
 * Mirrors the frontend's existing invoice lifecycle exactly — this isn't a
 * free-text status column, it's a fixed, enforced set of stages so a typo
 * can never silently create an invoice stuck in a status nothing else
 * recognizes.
 */
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "Draft",
  "Submitted",
  "Processing",
  "Documents Pending",
  "Ready",
  "Completed",
  "Cancelled",
]);

export const paymentTermsEnum = pgEnum("payment_terms", ["Pay Advance", "Pay Later", "Letter of Credit", "50% Advance / 50% on Shipment"]);

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").notNull().references(() => customers.id),

  invoiceNumber: text("invoice_number").notNull().unique(),
  currency: text("currency").notNull().default("INR"),

  paymentTerms: paymentTermsEnum("payment_terms").notNull().default("Pay Later"),
  advancePercent: integer("advance_percent").notNull().default(0),

  // Export-specific logistics — kept as one JSONB blob (like companies'
  // address/bank) because these fields are always read/written together as
  // a unit and never individually queried or filtered on.
  exportDetails: jsonb("export_details").$type<{
    originCountry: string;
    destinationCountry: string;
    portOfLoading?: string;
    portOfDischarge?: string;
    shippingMethod: string;
    incoterm?: string;
    shipmentDate?: string;
  }>().notNull(),

  // The checklist of document names required for this invoice — actual
  // uploaded files live in the (future) Documents module, linked back by
  // transactionId; this is just "what's required," not "what's uploaded."
  requiredDocs: jsonb("required_docs").$type<string[]>().notNull().default([]),

  status: invoiceStatusEnum("status").notNull().default("Draft"),
  submitted: boolean("submitted").notNull().default(false),
  submittedAt: timestamp("submitted_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * A real child table, not a JSONB array — unlike exportDetails above, line
 * items each have their own numeric amount that needs to add up correctly,
 * and a real relational table lets a future report query "every line item
 * that used Product X across every invoice" without parsing JSON.
 */
export const invoiceItems = pgTable("invoice_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  productId: uuid("product_id"), // nullable — a line item can be typed manually, not every product comes from the catalog

  description: text("description").notNull(),
  hsCode: text("hs_code"),
  unit: text("unit").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  rate: numeric("rate", { precision: 12, scale: 2 }).notNull(),
  taxPercent: numeric("tax_percent", { precision: 5, scale: 2 }).notNull().default("0"),

  sortOrder: integer("sort_order").notNull().default(0),
});

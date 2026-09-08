import { pgTable, text, timestamp, uuid, numeric, integer, boolean, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { vendors } from "./vendors.js";
import { paymentTermsEnum } from "./invoices.js";

export const billStatusEnum = pgEnum("bill_status", [
  "Draft",
  "Submitted",
  "Processing",
  "Documents Pending",
  "Ready",
  "Completed",
  "Cancelled",
]);

export const bills = pgTable("bills", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  vendorId: uuid("vendor_id").notNull().references(() => vendors.id),

  billNumber: text("bill_number").notNull().unique(),
  currency: text("currency").notNull().default("INR"),

  paymentTerms: paymentTermsEnum("payment_terms").notNull().default("Pay Later"),
  advancePercent: integer("advance_percent").notNull().default(0),

  // Import-specific logistics + customs — same "always read/written as one
  // unit" reasoning as invoices.exportDetails.
  importDetails: jsonb("import_details").$type<{
    originCountry: string;
    destinationCountry: string;
    portOfLoading?: string;
    portOfDischarge?: string;
    shippingMethod: string;
    customsReference?: string;
    shipmentDate?: string;
  }>().notNull(),

  requiredDocs: jsonb("required_docs").$type<string[]>().notNull().default([]),

  status: billStatusEnum("status").notNull().default("Draft"),
  submitted: boolean("submitted").notNull().default(false),
  submittedAt: timestamp("submitted_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const billItems = pgTable("bill_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  billId: uuid("bill_id").notNull().references(() => bills.id, { onDelete: "cascade" }),
  productId: uuid("product_id"),

  description: text("description").notNull(),
  hsCode: text("hs_code"),
  unit: text("unit").notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  rate: numeric("rate", { precision: 12, scale: 2 }).notNull(),
  taxPercent: numeric("tax_percent", { precision: 5, scale: 2 }).notNull().default("0"),

  sortOrder: integer("sort_order").notNull().default(0),
});

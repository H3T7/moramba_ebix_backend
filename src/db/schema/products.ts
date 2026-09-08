import { pgTable, text, timestamp, uuid, numeric } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

/**
 * `numeric` (not a plain JS number type like `integer` or `real`) is used
 * for `defaultRate` because floating-point numbers can't represent every
 * decimal value exactly — 0.1 + 0.2 famously equals 0.30000000000000004 in
 * JS/most languages. For money, that kind of rounding error is unacceptable.
 * Postgres's `numeric` type stores decimals exactly, at the cost of being
 * a plain string when it comes back through the driver (Drizzle gives you
 * a string here, not a number) — you convert it to a number only at the
 * point you actually do arithmetic, and back to a fixed-precision string
 * before saving. We'll follow this same pattern for every money column
 * in Invoices, Bills, and Payments.
 */
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),

  itemCode: text("item_code").notNull(),
  name: text("name").notNull(),
  sku: text("sku").notNull(),
  category: text("category").notNull(),
  unit: text("unit").notNull(), // e.g. "meters", "kg", "drums"
  hsCode: text("hs_code").notNull(), // customs Harmonized System code
  defaultRate: numeric("default_rate", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("INR"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

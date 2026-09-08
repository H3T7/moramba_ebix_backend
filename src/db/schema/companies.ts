import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";

/**
 * One row per trading company (what the frontend calls "Company Profile").
 * `address` and `bank` are stored as JSONB — a JSON blob inside a Postgres
 * column — because they're always read/written as a whole object together,
 * never queried field-by-field. That's the rule of thumb for JSONB vs. real
 * columns: if you'll never do `WHERE address->>'city' = 'Surat'`-style
 * queries, JSONB is simpler than five separate columns.
 */
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  logoText: text("logo_text").notNull(),
  logoColor: text("logo_color").notNull(),
  taxId: text("tax_id").notNull(),
  currency: text("currency").notNull().default("INR"),

  address: jsonb("address").$type<{
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  }>().notNull(),

  bank: jsonb("bank").$type<{
    accountName: string;
    accountNumber: string;
    bankName: string;
    ifsc: string;
    swiftCode?: string;
    branch?: string;
  }>().notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

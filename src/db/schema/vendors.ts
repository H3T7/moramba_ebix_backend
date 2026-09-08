import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

/**
 * The mirror of Customers — Vendors are who you BUY from, referenced on
 * every Import Bill. Same shape as customers.ts plus a `category`
 * (Raw Material, Finished Goods, Logistics, etc.) for grouping/reporting.
 */
export const vendors = pgTable("vendors", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),

  name: text("name").notNull(),
  country: text("country").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  gstin: text("gstin"),
  category: text("category").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

/**
 * A "master" table, in accounting/ERP terminology, just means a reusable
 * reference record — you create a Customer once, then pick it from a
 * dropdown on every Export Invoice afterward instead of retyping their
 * details each time. Customers are the overseas BUYERS in a sale.
 */
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),

  name: text("name").notNull(),
  country: text("country").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  gstin: text("gstin"), // tax ID / VAT / GSTIN — optional since it varies by country

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

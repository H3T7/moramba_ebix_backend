import { pgTable, uuid, text, date, timestamp, pgEnum, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";
import { invoices } from "./invoices.js";
import { bills } from "./bills.js";

export const shipmentStatusEnum = pgEnum("shipment_status", ["Preparing", "In Transit", "Customs", "Delivered", "Delayed", "Cancelled"]);

/** Same "exactly one parent" rule as Payments/Documents — see payments.ts for the full reasoning. */
export const shipments = pgTable(
  "shipments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }),
    billId: uuid("bill_id").references(() => bills.id, { onDelete: "cascade" }),

    carrier: text("carrier").notNull(),
    trackingNumber: text("tracking_number"),
    origin: text("origin").notNull(),
    destination: text("destination").notNull(),
    expectedDate: date("expected_date"),
    actualDate: date("actual_date"),

    status: shipmentStatusEnum("status").notNull().default("Preparing"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    check(
      "shipment_exactly_one_parent",
      sql`(${table.invoiceId} is not null and ${table.billId} is null) or (${table.invoiceId} is null and ${table.billId} is not null)`
    ),
  ]
);

/** Append-only timeline — one row per status change, never edited or deleted. Powers the tracking view. */
export const shipmentEvents = pgTable("shipment_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  shipmentId: uuid("shipment_id").notNull().references(() => shipments.id, { onDelete: "cascade" }),
  status: shipmentStatusEnum("status").notNull(),
  note: text("note"),
  location: text("location"),
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
});

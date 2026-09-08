import { db, pool } from "./client.js";
import {
  companies,
  employees,
  employeeCompanies,
  verifiers,
  customers,
  vendors,
  products,
  invitations,
  invoices,
  invoiceItems,
  bills,
  billItems,
  payments,
  documents,
  documentVersions,
  shipments,
  shipmentEvents,
  salaryStructures,
  payrollRuns,
  payrollEntries,
} from "./schema/index.js";

/**
 * Unlike `db:seed`, this leaves the database completely empty — no demo
 * company, no demo employees, nothing. Use this when you want to test the
 * REAL registration → email verification → login → create company (as
 * Owner) flow from absolute scratch, exactly like a brand-new person
 * signing up for the first time, with nothing pre-existing to lean on.
 *
 * Run it with: npm run db:wipe
 * Table shapes (from migrations) are untouched — only the data is cleared.
 */
async function main() {
  console.log("🧹 Wiping all data (keeping table structure)...");

  // Same child-before-parent order as seed.ts — see the comment there on
  // why every table has to be listed explicitly, in the right order.
  await db.delete(payrollEntries);
  await db.delete(payrollRuns);
  await db.delete(salaryStructures);
  await db.delete(shipmentEvents);
  await db.delete(shipments);
  await db.delete(documentVersions);
  await db.delete(documents);
  await db.delete(payments);
  await db.delete(invoiceItems);
  await db.delete(invoices);
  await db.delete(billItems);
  await db.delete(bills);
  await db.delete(invitations);
  await db.delete(employeeCompanies);
  await db.delete(employees);
  await db.delete(customers);
  await db.delete(vendors);
  await db.delete(products);
  await db.delete(companies);
  await db.delete(verifiers);

  console.log("✅ Database is empty. Register a brand-new account at POST /api/auth/register to start fresh.");
  await pool.end();
}

main().catch((err) => {
  console.error("❌ Wipe failed:", err);
  process.exit(1);
});

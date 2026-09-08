// Every schema file gets re-exported here. The rest of the app (and
// drizzle-kit, when it generates migrations) imports from this single file
// instead of reaching into src/db/schema/companies.ts etc. individually.
//
// As we build out more modules (customers, vendors, products, invoices,
// bills, payments, documents, shipments, payroll, verification events),
// their schema files will get added here too.

export * from "./companies.js";
export * from "./employees.js";
export * from "./employeeCompanies.js";
export * from "./verifiers.js";
export * from "./customers.js";
export * from "./vendors.js";
export * from "./products.js";
export * from "./invitations.js";
export * from "./invoices.js";
export * from "./bills.js";
export * from "./payments.js";
export * from "./documents.js";
export * from "./shipments.js";
export * from "./payroll.js";

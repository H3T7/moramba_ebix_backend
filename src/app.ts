import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { companyRouter } from "./modules/company/company.routes.js";
import { employeeRouter, companyEmployeeRouter } from "./modules/employee/employee.routes.js";
import { customerRouter, companyCustomerRouter } from "./modules/customer/customer.routes.js";
import { vendorRouter, companyVendorRouter } from "./modules/vendor/vendor.routes.js";
import { productRouter, companyProductRouter } from "./modules/product/product.routes.js";
import { invitationRouter, companyInvitationRouter } from "./modules/invitation/invitation.routes.js";
import { invoiceRouter, companyInvoiceRouter } from "./modules/invoice/invoice.routes.js";
import { billRouter, companyBillRouter } from "./modules/bill/bill.routes.js";
import { paymentRouter, companyPaymentRouter, transactionPaymentRouter } from "./modules/payment/payment.routes.js";
import { documentRouter, companyDocumentRouter, transactionDocumentRouter, verifierDocumentRouter } from "./modules/document/document.routes.js";
import { verifierAuthRouter } from "./modules/verifier-auth/verifierAuth.routes.js";
import { shipmentRouter, companyShipmentRouter, transactionShipmentRouter } from "./modules/shipment/shipment.routes.js";
import { payrollRouter, companyPayrollRouter, employeePayrollRouter } from "./modules/payroll/payroll.routes.js";

/**
 * Why is "build the app" separate from "start listening on a port"?
 * Mainly for testing: a test file can import `app` and send fake requests
 * straight to it (via a library like supertest) without ever actually
 * opening a network port. We're not writing those tests yet, but keeping
 * this separation from day one costs nothing and saves a refactor later.
 */
export const app = express();

// ---- Global middleware (runs on EVERY request, in this order) ----

app.use(helmet()); // sets a bunch of security-related HTTP headers automatically
app.use(
  cors({
    origin: env.CORS_ORIGIN, // only the Moramba frontend's origin may call this API from a browser
    credentials: true,
  })
);
app.use(express.json()); // parses incoming JSON request bodies into req.body
app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined")); // logs every request to the console

// ---- Health check ----
// Convention: a simple, unauthenticated endpoint to answer "is the server
// up, and can it reach the database?" — useful for load balancers, uptime
// monitors, and just sanity-checking your own setup while developing.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ---- Feature routes ----
// Every route below ends up prefixed with these paths, e.g. POST /api/auth/login
app.use("/api/auth", authRouter);
app.use("/api/companies", companyRouter);
app.use("/api/companies", companyEmployeeRouter); // adds GET/POST /api/companies/:companyId/employees
app.use("/api/employees", employeeRouter);
app.use("/api/companies", companyCustomerRouter); // adds GET/POST /api/companies/:companyId/customers
app.use("/api/customers", customerRouter);
app.use("/api/companies", companyVendorRouter); // adds GET/POST /api/companies/:companyId/vendors
app.use("/api/vendors", vendorRouter);
app.use("/api/companies", companyProductRouter); // adds GET/POST /api/companies/:companyId/products
app.use("/api/products", productRouter);
app.use("/api/companies", companyInvitationRouter); // adds GET/POST /api/companies/:companyId/invitations
app.use("/api/invitations", invitationRouter);
app.use("/api/companies", companyInvoiceRouter); // adds GET/POST /api/companies/:companyId/invoices
app.use("/api/invoices", invoiceRouter);
app.use("/api/companies", companyBillRouter); // adds GET/POST /api/companies/:companyId/bills
app.use("/api/bills", billRouter);
app.use("/api/companies", companyPaymentRouter); // adds GET/POST /api/companies/:companyId/payments
app.use("/api/payments", paymentRouter);
app.use("/api/transactions", transactionPaymentRouter); // adds GET /api/transactions/:transactionId/payments(/summary)
app.use("/api/companies", companyDocumentRouter); // adds GET/POST /api/companies/:companyId/documents
app.use("/api/documents", documentRouter);
app.use("/api/transactions", transactionDocumentRouter); // adds GET /api/transactions/:transactionId/documents
app.use("/api/verifier-auth", verifierAuthRouter);
app.use("/api/verifier/documents", verifierDocumentRouter);
app.use("/api/companies", companyShipmentRouter); // adds GET/POST /api/companies/:companyId/shipments
app.use("/api/shipments", shipmentRouter);
app.use("/api/transactions", transactionShipmentRouter); // adds GET /api/transactions/:transactionId/shipments
app.use("/api/companies", companyPayrollRouter); // adds POST .../salary-structures, POST+GET .../payroll-runs
app.use("/api/employees", employeePayrollRouter); // adds GET /api/employees/:employeeId/salary-history
app.use("/api/payroll", payrollRouter);

// ---- 404 + error handling (must be LAST) ----
app.use(notFoundHandler);
app.use(errorHandler);

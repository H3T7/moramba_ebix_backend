import { Router } from "express";
import { list, getOne, create, update, updateStatus, submit, remove } from "./invoice.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

/**
 * RBAC matches Customers: Admin + Accountant own trade finance. Submit is
 * separately gated Admin-only — locking an invoice is a one-way,
 * consequential action (see invoice.service.ts), same idea as membership
 * role changes being tighter than the rest of Employees.
 */
export const invoiceRouter = Router();
export const companyInvoiceRouter = Router();

companyInvoiceRouter.get("/:companyId/invoices", requireAuth, requireRole("admin", "accountant"), list);
companyInvoiceRouter.post("/:companyId/invoices", requireAuth, requireRole("admin", "accountant"), create);

invoiceRouter.get("/:id", requireAuth, requireRole("admin", "accountant"), getOne);
invoiceRouter.patch("/:id", requireAuth, requireRole("admin", "accountant"), update);
invoiceRouter.patch("/:id/status", requireAuth, requireRole("admin"), updateStatus);
invoiceRouter.post("/:id/submit", requireAuth, requireRole("admin"), submit);
invoiceRouter.delete("/:id", requireAuth, requireRole("admin"), remove);

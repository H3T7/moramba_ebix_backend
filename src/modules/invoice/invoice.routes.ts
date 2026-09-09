import { Router } from "express";
import { list, getOne, create, update, updateStatus, submit, remove } from "./invoice.controller.js";
import { requireAuth, requireCompanyParamRole, requireCompanyRole, companyIdFromRecord } from "../../middleware/auth.js";
import { prisma } from "../../db/client.js";

export const invoiceRouter = Router();
export const companyInvoiceRouter = Router();

const companyIdFromInvoice = companyIdFromRecord((id) => prisma.invoice.findUnique({ where: { id } }), "Invoice not found.");

companyInvoiceRouter.get("/:companyId/invoices", requireAuth, requireCompanyParamRole("admin", "accountant"), list);
companyInvoiceRouter.post("/:companyId/invoices", requireAuth, requireCompanyParamRole("admin", "accountant"), create);

invoiceRouter.get("/:id", requireAuth, requireCompanyRole(companyIdFromInvoice, "admin", "accountant"), getOne);
invoiceRouter.patch("/:id", requireAuth, requireCompanyRole(companyIdFromInvoice, "admin", "accountant"), update);
invoiceRouter.patch("/:id/status", requireAuth, requireCompanyRole(companyIdFromInvoice, "admin"), updateStatus);
invoiceRouter.post("/:id/submit", requireAuth, requireCompanyRole(companyIdFromInvoice, "admin"), submit);
invoiceRouter.delete("/:id", requireAuth, requireCompanyRole(companyIdFromInvoice, "admin"), remove);

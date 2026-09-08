import { Router } from "express";
import { create, list, listForTransaction, summaryForTransaction, getOne, updateStatus, remove } from "./payment.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

/** Same RBAC as Customers/Vendors/Invoices/Bills — Admin + Accountant own finance. */
export const paymentRouter = Router();
export const companyPaymentRouter = Router();
export const transactionPaymentRouter = Router();

companyPaymentRouter.get("/:companyId/payments", requireAuth, requireRole("admin", "accountant"), list);
companyPaymentRouter.post("/:companyId/payments", requireAuth, requireRole("admin", "accountant"), create);

// ?type=invoice|bill — a payment can belong to either, see payments.ts's CHECK constraint.
transactionPaymentRouter.get("/:transactionId/payments", requireAuth, requireRole("admin", "accountant"), listForTransaction);
transactionPaymentRouter.get("/:transactionId/payments/summary", requireAuth, requireRole("admin", "accountant"), summaryForTransaction);

paymentRouter.get("/:id", requireAuth, requireRole("admin", "accountant"), getOne);
paymentRouter.patch("/:id/status", requireAuth, requireRole("admin"), updateStatus);
paymentRouter.delete("/:id", requireAuth, requireRole("admin"), remove);

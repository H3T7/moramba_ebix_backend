import { Router } from "express";
import { create, list, listForTransaction, summaryForTransaction, getOne, updateStatus, remove } from "./payment.controller.js";
import { requireAuth, requireCompanyParamRole, requireCompanyRole, companyIdFromRecord } from "../../middleware/auth.js";
import { prisma } from "../../db/client.js";

export const paymentRouter = Router();
export const companyPaymentRouter = Router();
export const transactionPaymentRouter = Router();

const companyIdFromPayment = companyIdFromRecord((id) => prisma.payment.findUnique({ where: { id } }), "Payment not found.");

async function companyIdFromTransaction(id: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (invoice) return invoice.companyId;
  const bill = await prisma.bill.findUnique({ where: { id } });
  if (bill) return bill.companyId;
  return null;
}
function requireCompanyRoleForTransaction(...roles: string[]) {
  return requireCompanyRole(async (req) => {
    const companyId = await companyIdFromTransaction(req.params.transactionId as string);
    if (!companyId) throw new Error("Transaction not found.");
    return companyId;
  }, ...roles);
}

companyPaymentRouter.get("/:companyId/payments", requireAuth, requireCompanyParamRole("admin", "accountant"), list);
companyPaymentRouter.post("/:companyId/payments", requireAuth, requireCompanyParamRole("admin", "accountant"), create);

transactionPaymentRouter.get("/:transactionId/payments", requireAuth, requireCompanyRoleForTransaction("admin", "accountant"), listForTransaction);
transactionPaymentRouter.get("/:transactionId/payments/summary", requireAuth, requireCompanyRoleForTransaction("admin", "accountant"), summaryForTransaction);

paymentRouter.get("/:id", requireAuth, requireCompanyRole(companyIdFromPayment, "admin", "accountant"), getOne);
paymentRouter.patch("/:id/status", requireAuth, requireCompanyRole(companyIdFromPayment, "admin"), updateStatus);
paymentRouter.delete("/:id", requireAuth, requireCompanyRole(companyIdFromPayment, "admin"), remove);

import { Router } from "express";
import { upload, list, listForTransaction, getOne, replace, review, verifierQueue, remove } from "./document.controller.js";
import { requireAuth, requireCompanyParamRole, requireCompanyRole, companyIdFromRecord, requireVerifierAuth } from "../../middleware/auth.js";
import { prisma } from "../../db/client.js";

export const documentRouter = Router();
export const companyDocumentRouter = Router();
export const transactionDocumentRouter = Router();
export const verifierDocumentRouter = Router();

const companyIdFromDocument = companyIdFromRecord((id) => prisma.document.findUnique({ where: { id } }), "Document not found.");

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

companyDocumentRouter.get("/:companyId/documents", requireAuth, requireCompanyParamRole("admin", "accountant"), list);
companyDocumentRouter.post("/:companyId/documents", requireAuth, requireCompanyParamRole("admin", "accountant"), upload);

transactionDocumentRouter.get("/:transactionId/documents", requireAuth, requireCompanyRoleForTransaction("admin", "accountant"), listForTransaction);

documentRouter.get("/:id", requireAuth, requireCompanyRole(companyIdFromDocument, "admin", "accountant"), getOne);
documentRouter.post("/:id/replace", requireAuth, requireCompanyRole(companyIdFromDocument, "admin", "accountant"), replace);
documentRouter.delete("/:id", requireAuth, requireCompanyRole(companyIdFromDocument, "admin"), remove);

verifierDocumentRouter.get("/queue", requireVerifierAuth, verifierQueue);
verifierDocumentRouter.get("/:id", requireVerifierAuth, getOne);
verifierDocumentRouter.post("/:id/review", requireVerifierAuth, review);

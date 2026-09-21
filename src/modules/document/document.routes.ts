import { Router } from "express";
import { upload, list, listForTransaction, getOne, file, replace, updateMeta, review, verifierQueue, remove } from "./document.controller.js";
import { requireAuth, requireCompanyParamRole, requireCompanyRole, companyIdFromRecord, requireVerifierAuth } from "../../middleware/auth.js";
import { singleFileUpload } from "../../middleware/upload.js";
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
// singleFileUpload sits AFTER the auth/role checks on purpose — someone who
// isn't allowed to upload never gets their request body parsed at all.
companyDocumentRouter.post("/:companyId/documents", requireAuth, requireCompanyParamRole("admin", "accountant"), singleFileUpload, upload);

transactionDocumentRouter.get("/:transactionId/documents", requireAuth, requireCompanyRoleForTransaction("admin", "accountant"), listForTransaction);

documentRouter.get("/:id", requireAuth, requireCompanyRole(companyIdFromDocument, "admin", "accountant"), getOne);
documentRouter.get("/:id/file", requireAuth, requireCompanyRole(companyIdFromDocument, "admin", "accountant"), file);
documentRouter.post("/:id/replace", requireAuth, requireCompanyRole(companyIdFromDocument, "admin", "accountant"), singleFileUpload, replace);
documentRouter.patch("/:id", requireAuth, requireCompanyRole(companyIdFromDocument, "admin", "accountant"), updateMeta);
documentRouter.delete("/:id", requireAuth, requireCompanyRole(companyIdFromDocument, "admin"), remove);

verifierDocumentRouter.get("/queue", requireVerifierAuth, verifierQueue);
verifierDocumentRouter.get("/:id", requireVerifierAuth, getOne);
verifierDocumentRouter.get("/:id/file", requireVerifierAuth, file);
verifierDocumentRouter.post("/:id/review", requireVerifierAuth, review);
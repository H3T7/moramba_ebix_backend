import { Router } from "express";
import { upload, list, listForTransaction, getOne, replace, review, verifierQueue, remove } from "./document.controller.js";
import { requireAuth, requireRole, requireVerifierAuth } from "../../middleware/auth.js";

export const documentRouter = Router();
export const companyDocumentRouter = Router();
export const transactionDocumentRouter = Router();
export const verifierDocumentRouter = Router();

companyDocumentRouter.get("/:companyId/documents", requireAuth, requireRole("admin", "accountant"), list);
companyDocumentRouter.post("/:companyId/documents", requireAuth, requireRole("admin", "accountant"), upload);

// ?type=invoice|bill — same pattern as Payments, see payments.routes.ts
transactionDocumentRouter.get("/:transactionId/documents", requireAuth, requireRole("admin", "accountant"), listForTransaction);

documentRouter.get("/:id", requireAuth, requireRole("admin", "accountant"), getOne);
documentRouter.post("/:id/replace", requireAuth, requireRole("admin", "accountant"), replace);
documentRouter.delete("/:id", requireAuth, requireRole("admin"), remove);

// The Verifier Portal — a completely separate identity realm, gated by
// requireVerifierAuth (not requireAuth+requireRole). ?status= filters the
// queue, e.g. ?status=Pending Verification.
verifierDocumentRouter.get("/queue", requireVerifierAuth, verifierQueue);
verifierDocumentRouter.get("/:id", requireVerifierAuth, getOne);
verifierDocumentRouter.post("/:id/review", requireVerifierAuth, review);

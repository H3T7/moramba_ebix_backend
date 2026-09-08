import { Router } from "express";
import { create, listForCompany, listMine, accept, reject, resend, cancel } from "./invitation.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

/**
 * Mounted at TWO base paths in app.ts:
 *   /api/companies/:companyId/invitations   → create, list (Admin/HR — company-side management)
 *   /api/invitations                         → mine, accept, reject (any authenticated employee — their OWN invitations)
 *   /api/invitations/:id/resend|cancel       → Admin/HR only
 *
 * Notice accept/reject/mine have NO role restriction beyond being signed
 * in — anyone can see and answer invitations addressed to their own email.
 * The service layer (not the route) is what actually enforces "this
 * invitation must be addressed to YOUR email" — see
 * invitation.service.ts's getPendingInvitationForEmail.
 */
export const invitationRouter = Router();
export const companyInvitationRouter = Router();

companyInvitationRouter.post("/:companyId/invitations", requireAuth, requireRole("admin", "hr"), create);
companyInvitationRouter.get("/:companyId/invitations", requireAuth, requireRole("admin", "hr"), listForCompany);

invitationRouter.get("/mine", requireAuth, listMine);
invitationRouter.post("/:id/accept", requireAuth, accept);
invitationRouter.post("/:id/reject", requireAuth, reject);
invitationRouter.post("/:id/resend", requireAuth, requireRole("admin", "hr"), resend);
invitationRouter.post("/:id/cancel", requireAuth, requireRole("admin", "hr"), cancel);

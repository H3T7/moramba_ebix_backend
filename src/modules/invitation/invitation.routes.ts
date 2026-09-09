import { Router } from "express";
import { create, listForCompany, listMine, accept, reject, resend, cancel } from "./invitation.controller.js";
import { requireAuth, requireCompanyParamRole, requireCompanyRole, companyIdFromRecord } from "../../middleware/auth.js";
import { prisma } from "../../db/client.js";

export const invitationRouter = Router();
export const companyInvitationRouter = Router();

const companyIdFromInvitation = companyIdFromRecord((id) => prisma.invitation.findUnique({ where: { id } }), "Invitation not found.");

companyInvitationRouter.post("/:companyId/invitations", requireAuth, requireCompanyParamRole("admin", "hr"), create);
companyInvitationRouter.get("/:companyId/invitations", requireAuth, requireCompanyParamRole("admin", "hr"), listForCompany);

invitationRouter.get("/mine", requireAuth, listMine);
invitationRouter.post("/:id/accept", requireAuth, accept);
invitationRouter.post("/:id/reject", requireAuth, reject);
invitationRouter.post("/:id/resend", requireAuth, requireCompanyRole(companyIdFromInvitation, "admin", "hr"), resend);
invitationRouter.post("/:id/cancel", requireAuth, requireCompanyRole(companyIdFromInvitation, "admin", "hr"), cancel);

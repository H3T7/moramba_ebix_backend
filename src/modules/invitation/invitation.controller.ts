import type { Request, Response } from "express";
import { createInvitationSchema } from "./invitation.schema.js";
import {
  createInvitation,
  listInvitationsByCompany,
  listMyPendingInvitations,
  acceptInvitation,
  rejectInvitation,
  resendInvitation,
  cancelInvitation,
} from "./invitation.service.js";
import { getUserById } from "../auth/auth.service.js";

export async function create(req: Request, res: Response) {
  const input = createInvitationSchema.parse(req.body);
  // req.employee is the CALLER's own row at this company, resolved by
  // requireCompanyParamRole — an invitation records the actual employee
  // who sent it, not just "some user somewhere."
  const invitation = await createInvitation(req.params.companyId as string, req.employee!.id, input);
  res.status(201).json(invitation);
}

export async function listForCompany(req: Request, res: Response) {
  const list = await listInvitationsByCompany(req.params.companyId as string);
  res.status(200).json(list);
}

export async function listMine(req: Request, res: Response) {
  const { user } = await getUserById(req.user!.sub);
  const list = await listMyPendingInvitations(user.email);
  res.status(200).json(list);
}

/**
 * No token-refresh dance needed here anymore — see company.controller.ts's
 * create() for the full reasoning. Accepting an invitation used to be able
 * to change a stale RBAC role baked into the JWT; now that role is never
 * on the token at all (resolved fresh per company per request instead),
 * there's nothing here that could ever go stale.
 */
export async function accept(req: Request, res: Response) {
  const { user } = await getUserById(req.user!.sub);
  const result = await acceptInvitation(req.params.id as string, user);
  res.status(200).json(result);
}

export async function reject(req: Request, res: Response) {
  const { user } = await getUserById(req.user!.sub);
  const result = await rejectInvitation(req.params.id as string, user.email);
  res.status(200).json(result);
}

export async function resend(req: Request, res: Response) {
  const result = await resendInvitation(req.params.id as string);
  res.status(200).json(result);
}

export async function cancel(req: Request, res: Response) {
  const result = await cancelInvitation(req.params.id as string);
  res.status(200).json(result);
}

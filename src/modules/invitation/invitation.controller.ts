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
import { getEmployeeById } from "../auth/auth.service.js";
import { AppError } from "../../middleware/errorHandler.js";

export async function create(req: Request, res: Response) {
  const input = createInvitationSchema.parse(req.body);
  const invitation = await createInvitation(req.params.companyId as string, req.user!.sub, input);
  res.status(201).json(invitation);
}

export async function listForCompany(req: Request, res: Response) {
  const list = await listInvitationsByCompany(req.params.companyId as string);
  res.status(200).json(list);
}

export async function listMine(req: Request, res: Response) {
  const { employee } = await getEmployeeById(req.user!.sub);
  const list = await listMyPendingInvitations(employee.email);
  res.status(200).json(list);
}

export async function accept(req: Request, res: Response) {
  const { employee } = await getEmployeeById(req.user!.sub);
  const result = await acceptInvitation(req.params.id as string, employee);
  res.status(200).json(result);
}

export async function reject(req: Request, res: Response) {
  const { employee } = await getEmployeeById(req.user!.sub);
  const result = await rejectInvitation(req.params.id as string, employee.email);
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

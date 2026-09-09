import { prisma } from "../../db/client.js";
import { AppError } from "../../middleware/errorHandler.js";
import { mapEmploymentType } from "../../lib/enumMaps.js";
import type { CreateInvitationInput } from "./invitation.schema.js";

const INVITATION_WINDOW_DAYS = 7;

/**
 * Lazily flips any PENDING invitation whose window has passed into EXPIRED,
 * right before we return a list.
 */
async function expireStaleInvitations(companyId?: string) {
  await prisma.invitation.updateMany({
    where: { status: "pending", expiresAt: { lt: new Date() }, ...(companyId ? { companyId } : {}) },
    data: { status: "expired" },
  });
}

export async function createInvitation(companyId: string, invitedByEmployeeId: string, input: CreateInvitationInput) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError(404, "That company doesn't exist.");

  const email = input.email.toLowerCase();

  await expireStaleInvitations(companyId);

  const existingPending = await prisma.invitation.findFirst({ where: { companyId, email, status: "pending" } });
  if (existingPending) {
    throw new AppError(409, "There's already a pending invitation for that email at this company.");
  }

  // If this email already belongs to a Moramba ACCOUNT (a `users` row —
  // not an `employees` row, since the person invited might not have any
  // company yet), we link to it. No membership is created yet either
  // way — that only happens on accept.
  const existingUser = await prisma.user.findUnique({ where: { email } });

  const invitedAt = new Date();
  const expiresAt = new Date(invitedAt.getTime() + INVITATION_WINDOW_DAYS * 86400000);

  return prisma.invitation.create({
    data: {
      companyId,
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      department: input.department,
      designation: input.designation,
      phone: input.phone,

      // Milestone 12 revision — job/payment details the Admin filled in
      // on the "Add employee" form now travel WITH the invitation, so
      // acceptInvitation() below can put them on the real `employees`
      // row instead of them silently getting lost to Prisma defaults.
      employeeCode: input.employeeCode,
      dateOfJoining: input.dateOfJoining ? new Date(input.dateOfJoining) : undefined,
      employmentType: input.employmentType ? mapEmploymentType(input.employmentType) : undefined,
      paymentMode: input.paymentMode,
      bankAccountNumber: input.bankAccountNumber,
      bankIfsc: input.bankIfsc,
      bankName: input.bankName,

      invitedUserId: existingUser?.id,
      invitedByEmployeeId,
      invitedAt,
      expiresAt,
    },
  });
}

export async function listInvitationsByCompany(companyId: string) {
  await expireStaleInvitations(companyId);
  const rows = await prisma.invitation.findMany({
    where: { companyId },
    include: { invitedByEmployee: { include: { user: true } } },
  });

  return rows.map((r) => {
    const { invitedByEmployee, ...invite } = r;
    return { ...invite, invitedByName: `${invitedByEmployee.user.firstName} ${invitedByEmployee.user.lastName}` };
  });
}

/**
 * Every pending invitation addressed to this exact email, across every
 * company — joined with the company's own name/logo so the UI can display
 * "You've been invited to join Acme Trading" without a second round-trip.
 */
export async function listMyPendingInvitations(email: string) {
  await expireStaleInvitations();
  const normalizedEmail = email.toLowerCase();
  const rows = await prisma.invitation.findMany({
    where: { email: normalizedEmail, status: "pending" },
    include: { company: true },
  });

  return rows.map((r) => {
    const { company, ...invite } = r;
    return { ...invite, companyName: company.name, companyLogoColor: company.logoColor };
  });
}

async function getPendingInvitationForEmail(invitationId: string, email: string) {
  const invite = await prisma.invitation.findUnique({ where: { id: invitationId } });
  if (!invite) throw new AppError(404, "Invitation not found.");
  if (invite.email.toLowerCase() !== email.toLowerCase()) {
    throw new AppError(403, "This invitation isn't addressed to you.");
  }
  if (invite.status !== "pending") {
    throw new AppError(409, `This invitation is already ${invite.status} and can't be changed.`);
  }
  if (invite.expiresAt < new Date()) {
    await prisma.invitation.update({ where: { id: invite.id }, data: { status: "expired" } });
    throw new AppError(409, "This invitation has expired.");
  }
  return invite;
}

/**
 * PENDING -> ACCEPTED, then (and only then) a real `employees` row is
 * created or reactivated — this is the one moment an invitation actually
 * grants access. Milestone 12 revision: this is now the ONLY place an
 * `employees` row is ever created — see employee.service.ts's
 * createEmployee(), which no longer creates one directly for brand-new
 * emails either. Every job/payment field the Admin originally entered
 * (employeeCode, dateOfJoining, employmentType, paymentMode, bank
 * details) rides along on the invitation and gets applied here, instead
 * of silently falling back to Prisma's schema defaults.
 */
export async function acceptInvitation(invitationId: string, acceptingUser: { id: string; email: string }) {
  const invite = await getPendingInvitationForEmail(invitationId, acceptingUser.email);

  const { invite: updatedInvite, employee } = await prisma.$transaction(async (tx) => {
    const updatedInvite = await tx.invitation.update({ where: { id: invite.id }, data: { status: "accepted" } });

    const employeeData = {
      role: invite.role,
      status: "active" as const,
      department: invite.department ?? undefined,
      designation: invite.designation ?? undefined,
      employeeCode: invite.employeeCode ?? undefined,
      dateOfJoining: invite.dateOfJoining ?? undefined,
      employmentType: invite.employmentType ?? undefined,
      paymentMode: invite.paymentMode ?? undefined,
      bankAccountNumber: invite.bankAccountNumber ?? undefined,
      bankIfsc: invite.bankIfsc ?? undefined,
      bankName: invite.bankName ?? undefined,
    };

    // Upsert: if a row already exists for this (user, company) pair (e.g.
    // they were removed once before and are being re-invited), reactivate
    // it with the new details instead of erroring on the unique constraint.
    const employee = await tx.employee.upsert({
      where: { userId_companyId: { userId: acceptingUser.id, companyId: invite.companyId } },
      create: { userId: acceptingUser.id, companyId: invite.companyId, ...employeeData },
      update: employeeData,
    });

    return { invite: updatedInvite, employee };
  });

  const company = await prisma.company.findUnique({ where: { id: invite.companyId } });
  return { invitation: updatedInvite, company, employee };
}

export async function rejectInvitation(invitationId: string, email: string) {
  const invite = await getPendingInvitationForEmail(invitationId, email);
  return prisma.invitation.update({ where: { id: invite.id }, data: { status: "rejected" } });
}

export async function resendInvitation(invitationId: string) {
  const invite = await prisma.invitation.findUnique({ where: { id: invitationId } });
  if (!invite) throw new AppError(404, "Invitation not found.");
  if (invite.status !== "pending") throw new AppError(409, `Can't resend a ${invite.status} invitation.`);

  const invitedAt = new Date();
  const expiresAt = new Date(invitedAt.getTime() + INVITATION_WINDOW_DAYS * 86400000);
  return prisma.invitation.update({ where: { id: invite.id }, data: { invitedAt, expiresAt } });
}

export async function cancelInvitation(invitationId: string) {
  const invite = await prisma.invitation.findUnique({ where: { id: invitationId } });
  if (!invite) throw new AppError(404, "Invitation not found.");
  if (invite.status !== "pending") throw new AppError(409, `Can't cancel a ${invite.status} invitation.`);

  return prisma.invitation.update({ where: { id: invite.id }, data: { status: "cancelled" } });
}
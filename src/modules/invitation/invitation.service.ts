import { eq, and, lt, sql, aliasedTable } from "drizzle-orm";
import { db } from "../../db/client.js";
import { invitations, companies, employees, employeeCompanies } from "../../db/schema/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import type { CreateInvitationInput } from "./invitation.schema.js";

const INVITATION_WINDOW_DAYS = 7;

/**
 * Lazily flips any PENDING invitation whose window has passed into EXPIRED,
 * right before we return a list. There's no background job doing this on a
 * schedule — it's cheap enough to just check on read, and it means the
 * status is always correct whenever anyone actually looks at it.
 */
async function expireStaleInvitations(companyId?: string) {
  const condition = companyId
    ? and(eq(invitations.status, "pending"), lt(invitations.expiresAt, new Date()), eq(invitations.companyId, companyId))
    : and(eq(invitations.status, "pending"), lt(invitations.expiresAt, new Date()));
  await db.update(invitations).set({ status: "expired" }).where(condition);
}

export async function createInvitation(companyId: string, invitedByEmployeeId: string, input: CreateInvitationInput) {
  const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
  if (!company) throw new AppError(404, "That company doesn't exist.");

  await expireStaleInvitations(companyId);

  const existingPending = await db.query.invitations.findFirst({
    where: and(eq(invitations.companyId, companyId), eq(invitations.email, input.email), eq(invitations.status, "pending")),
  });
  if (existingPending) {
    throw new AppError(409, "There's already a pending invitation for that email at this company.");
  }

  // If this email already belongs to a Moramba account, we link to it —
  // but we do NOT create a membership yet. That only happens on accept.
  const existingEmployee = await db.query.employees.findFirst({ where: eq(employees.email, input.email) });

  const invitedAt = new Date();
  const expiresAt = new Date(invitedAt.getTime() + INVITATION_WINDOW_DAYS * 86400000);

  const [created] = await db
    .insert(invitations)
    .values({
      companyId,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      department: input.department,
      designation: input.designation,
      phone: input.phone,
      invitedEmployeeId: existingEmployee?.id,
      invitedByEmployeeId,
      invitedAt,
      expiresAt,
    })
    .returning();

  return created;
}

export async function listInvitationsByCompany(companyId: string) {
  await expireStaleInvitations(companyId);
  const inviter = aliasedTable(employees, "inviter");
  const rows = await db
    .select({ invitation: invitations, invitedByName: sql<string>`${inviter.firstName} || ' ' || ${inviter.lastName}` })
    .from(invitations)
    .innerJoin(inviter, eq(invitations.invitedByEmployeeId, inviter.id))
    .where(eq(invitations.companyId, companyId));

  return rows.map((r) => ({ ...r.invitation, invitedByName: r.invitedByName }));
}

/**
 * Every pending invitation addressed to this exact email, across every
 * company — joined with the company's own name/logo so the UI can display
 * "You've been invited to join Acme Trading" without a second round-trip.
 */
export async function listMyPendingInvitations(email: string) {
  await expireStaleInvitations();
  const rows = await db
    .select({ invitation: invitations, company: companies })
    .from(invitations)
    .innerJoin(companies, eq(invitations.companyId, companies.id))
    .where(and(eq(invitations.email, email), eq(invitations.status, "pending")));

  return rows.map((r) => ({
    ...r.invitation,
    companyName: r.company.name,
    companyLogoColor: r.company.logoColor,
  }));
}

async function getPendingInvitationForEmail(invitationId: string, email: string) {
  const invite = await db.query.invitations.findFirst({ where: eq(invitations.id, invitationId) });
  if (!invite) throw new AppError(404, "Invitation not found.");
  if (invite.email.toLowerCase() !== email.toLowerCase()) {
    throw new AppError(403, "This invitation isn't addressed to you.");
  }
  if (invite.status !== "pending") {
    throw new AppError(409, `This invitation is already ${invite.status} and can't be changed.`);
  }
  if (invite.expiresAt < new Date()) {
    await db.update(invitations).set({ status: "expired" }).where(eq(invitations.id, invite.id));
    throw new AppError(409, "This invitation has expired.");
  }
  return invite;
}

/**
 * PENDING -> ACCEPTED, then (and only then) a real membership is created.
 * This is the one moment an invitation actually grants access — everything
 * before this was just a record of an offer.
 */
export async function acceptInvitation(invitationId: string, acceptingEmployee: { id: string; email: string; companyId: string | null }) {
  const invite = await getPendingInvitationForEmail(invitationId, acceptingEmployee.email);

  await db.update(invitations).set({ status: "accepted" }).where(eq(invitations.id, invite.id));

  // Upsert: if a membership row already exists for this pair (e.g. they
  // were removed once before and are being re-invited), reactivate it with
  // the new role instead of erroring on the unique constraint.
  await db
    .insert(employeeCompanies)
    .values({ employeeId: acceptingEmployee.id, companyId: invite.companyId, role: invite.role, status: "active" })
    .onConflictDoUpdate({
      target: [employeeCompanies.employeeId, employeeCompanies.companyId],
      set: { role: invite.role, status: "active" },
    });

  // First company ever? Backfill it as their "home" employee record.
  if (!acceptingEmployee.companyId) {
    await db
      .update(employees)
      .set({
        companyId: invite.companyId,
        department: invite.department,
        designation: invite.designation,
        phone: invite.phone ?? undefined,
      })
      .where(eq(employees.id, acceptingEmployee.id));
  }

  const company = await db.query.companies.findFirst({ where: eq(companies.id, invite.companyId) });
  return { invitation: { ...invite, status: "accepted" as const }, company };
}

export async function rejectInvitation(invitationId: string, email: string) {
  const invite = await getPendingInvitationForEmail(invitationId, email);
  await db.update(invitations).set({ status: "rejected" }).where(eq(invitations.id, invite.id));
  return { ...invite, status: "rejected" as const };
}

export async function resendInvitation(invitationId: string) {
  const invite = await db.query.invitations.findFirst({ where: eq(invitations.id, invitationId) });
  if (!invite) throw new AppError(404, "Invitation not found.");
  if (invite.status !== "pending") throw new AppError(409, `Can't resend a ${invite.status} invitation.`);

  const invitedAt = new Date();
  const expiresAt = new Date(invitedAt.getTime() + INVITATION_WINDOW_DAYS * 86400000);
  const [updated] = await db.update(invitations).set({ invitedAt, expiresAt }).where(eq(invitations.id, invite.id)).returning();
  return updated;
}

export async function cancelInvitation(invitationId: string) {
  const invite = await db.query.invitations.findFirst({ where: eq(invitations.id, invitationId) });
  if (!invite) throw new AppError(404, "Invitation not found.");
  if (invite.status !== "pending") throw new AppError(409, `Can't cancel a ${invite.status} invitation.`);

  const [updated] = await db.update(invitations).set({ status: "cancelled" }).where(eq(invitations.id, invite.id)).returning();
  return updated;
}

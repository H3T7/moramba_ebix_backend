import { prisma } from "../../db/client.js";
import { hashPassword } from "../../lib/password.js";
import { AppError } from "../../middleware/errorHandler.js";
import { mapEmploymentType } from "../../lib/enumMaps.js";
import { createInvitation } from "../invitation/invitation.service.js";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "./employee.schema.js";
import type { Employee, User } from "@prisma/client";

/**
 * `employees` has no name/email/phone at all — those live on `users`. This
 * merges both rows into the flat shape the frontend has always expected.
 * Never leaks passwordHash.
 */
function toPublicEmployee(employee: Employee, user: User) {
  const { passwordHash: _hash, id: _userId, createdAt: _uc, updatedAt: _uu, ...userFields } = user;
  return { ...employee, ...userFields, userId: user.id };
}

export async function listEmployeesByCompany(companyId: string) {
  const rows = await prisma.employee.findMany({ where: { companyId }, include: { user: true } });
  return rows.map((r) => toPublicEmployee(r, r.user));
}

export async function getEmployee(id: string) {
  const found = await prisma.employee.findUnique({ where: { id }, include: { user: true } });
  if (!found) throw new AppError(404, "Employee not found.");
  return toPublicEmployee(found, found.user);
}

/**
 * Milestone 12 revision: company membership is now ALWAYS granted through
 * an invitation — whether the email is brand-new or already has an
 * account — never a direct-active `employees` row. The actual
 * `employees` row only ever gets created in invitation.service.ts's
 * acceptInvitation(), once the person explicitly accepts it.
 *
 *  - Brand-new email: no `users` row exists yet, so one is created right
 *    here with a system-generated temporary password (per the brief's
 *    FirstnameLastname@123 convention — still needed since there's no
 *    email service yet and they need *something* to log in with and see
 *    the pending invitation). An invitation is then created too.
 *  - Existing email: no new account, just an invitation, exactly as
 *    before.
 *
 * Either way the caller gets back `{ type: "invitation", invitation }`,
 * plus `temporaryPassword` when a new account was created — there is no
 * `{ type: "employee", ... }` case anymore.
 */
export async function createEmployee(companyId: string, invitedByEmployeeId: string, input: CreateEmployeeInput) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError(404, "That company doesn't exist.");

  const email = input.email.toLowerCase();
  let existingUser = await prisma.user.findUnique({ where: { email } });
  let temporaryPassword: string | undefined;

  if (!existingUser) {
    temporaryPassword = `${input.firstName}${input.lastName}@123`;
    const passwordHash = await hashPassword(temporaryPassword);
    existingUser = await prisma.user.create({
      data: { email, passwordHash, firstName: input.firstName, lastName: input.lastName, phone: input.phone },
    });
  }

  const invitation = await createInvitation(companyId, invitedByEmployeeId, {
    email,
    firstName: input.firstName,
    lastName: input.lastName,
    role: input.role,
    department: input.department,
    designation: input.designation,
    phone: input.phone,
    employeeCode: input.employeeCode,
    dateOfJoining: input.dateOfJoining,
    employmentType: input.employmentType,
    paymentMode: input.paymentMode,
    bankAccountNumber: input.bankAccountNumber,
    bankIfsc: input.bankIfsc,
    bankName: input.bankName,
  });

  return temporaryPassword
    ? { type: "invitation" as const, invitation, temporaryPassword }
    : { type: "invitation" as const, invitation };
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput) {
  const found = await prisma.employee.findUnique({ where: { id }, include: { user: true } });
  if (!found) throw new AppError(404, "Employee not found.");

  const { firstName, lastName, phone, ...employeeFields } = input;

  // Editing an EXISTING employee still writes to the `employees` table
  // directly (no invitation involved) — so this translation is still
  // needed here, same as before.
  if (typeof employeeFields.employmentType === "string") {
    employeeFields.employmentType = mapEmploymentType(employeeFields.employmentType) as unknown as typeof employeeFields.employmentType;
  }
  if (typeof employeeFields.dateOfJoining === "string") {
    employeeFields.dateOfJoining = new Date(employeeFields.dateOfJoining) as unknown as typeof employeeFields.dateOfJoining;
  }

  await prisma.$transaction(async (tx) => {
    const userPatch: Record<string, unknown> = {};
    if (firstName !== undefined) userPatch.firstName = firstName;
    if (lastName !== undefined) userPatch.lastName = lastName;
    if (phone !== undefined) userPatch.phone = phone;
    if (Object.keys(userPatch).length > 0) {
      await tx.user.update({ where: { id: found.userId }, data: userPatch });
    }
    if (Object.keys(employeeFields).length > 0) {
      await tx.employee.update({ where: { id }, data: employeeFields });
    }
  });

  return getEmployee(id);
}

export async function updateEmployeeStatus(id: string, status: "active" | "suspended" | "removed") {
  const updated = await prisma.employee.update({ where: { id }, data: { status } }).catch(() => null);
  if (!updated) throw new AppError(404, "Employee not found.");
  return getEmployee(id);
}

export async function updateEmployeeRole(id: string, role: Employee["role"]) {
  const updated = await prisma.employee.update({ where: { id }, data: { role } }).catch(() => null);
  if (!updated) throw new AppError(404, "Employee not found.");
  return getEmployee(id);
}

/**
 * A "removed" employee keeps their row (with full history intact) rather
 * than being hard-deleted. Their `users` account is untouched either way.
 */
export async function deleteEmployee(id: string) {
  const updated = await prisma.employee.update({ where: { id }, data: { status: "removed" } }).catch(() => null);
  if (!updated) throw new AppError(404, "Employee not found.");
  return { id: updated.id };
}
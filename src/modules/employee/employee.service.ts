import { prisma } from "../../db/client.js";
import { hashPassword } from "../../lib/password.js";
import { AppError } from "../../middleware/errorHandler.js";
import { mapEmploymentType, mapEmploymentTypeFromPrisma } from "../../lib/enumMaps.js";
import { createInvitation } from "../invitation/invitation.service.js";
import type { CreateEmployeeInput, UpdateEmployeeInput } from "./employee.schema.js";
import type { Employee, User } from "@prisma/client";

/**
 * `employees` has no name/email/phone at all — those live on `users`. This
 * merges both rows into the flat shape the frontend has always expected.
 * Never leaks passwordHash.
 *
 * Also translates two things back into the shape the frontend actually
 * consumes (both are otherwise silently wrong on every GET, breaking the
 * edit form's prefill even though the underlying data is fine):
 *  - employmentType: Prisma always returns the un-mapped enum key
 *    ("FullTime"), not the hyphenated form ("Full-time") the frontend's
 *    <select> options and Zod schemas use — see enumMaps.ts.
 *  - dob/dateOfJoining: Postgres `date` columns come back as full ISO
 *    datetimes ("2026-09-17T00:00:00.000Z"), which `<input type="date">`
 *    can't bind to — it needs exactly "YYYY-MM-DD".
 */
function toPublicEmployee(employee: Employee & { user?: User }, user: User) {
  const { passwordHash: _hash, id: _userId, createdAt: _uc, updatedAt: _uu, dob, ...userFields } = user;
  // `employee` comes from a `findMany`/`findUnique` with `include: { user: true }`
  // — it still carries that full nested `user` sub-object (passwordHash and
  // all) as an own property at runtime, even though the `Employee` type
  // doesn't declare it. Spreading `...employee` below would leak it straight
  // into the API response (this WAS happening — see the raw `"user": {...
  // "passwordHash": "$2b$10$..." }` block the real GET response was
  // returning). Drop it before spreading; the flattened, scrubbed fields
  // from `userFields` above are what the frontend actually reads.
  const { user: _nestedUser, ...employeeFields } = employee;
  return {
    ...employeeFields,
    ...userFields,
    userId: user.id,
    dob: dob ? dob.toISOString().slice(0, 10) : null,
    dateOfJoining: employee.dateOfJoining ? employee.dateOfJoining.toISOString().slice(0, 10) : null,
    employmentType: mapEmploymentTypeFromPrisma(employee.employmentType),
  };
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
 *    here with a fixed system temporary password (there's no email service
 *    yet, so they need *something* to log in with and see the pending
 *    invitation — they're expected to change it after logging in).
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
    // Fixed rather than personalized (was `${firstName}${lastName}@123`) —
    // simpler to communicate and remember while there's no email delivery
    // to send it automatically. It's a genuinely TEMPORARY password only:
    // the person is expected to change it after their first login.
    temporaryPassword = "Test@123";
    const passwordHash = await hashPassword(temporaryPassword);
    existingUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        dob: input.dob ? new Date(input.dob) : undefined,
        gender: input.gender,
        address: input.address,
      },
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
    dob: input.dob,
    gender: input.gender,
    address: input.address,
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

  const { firstName, lastName, phone, dob, gender, address, ...employeeFields } = input;

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
    if (dob !== undefined) userPatch.dob = dob ? new Date(dob) : null;
    if (gender !== undefined) userPatch.gender = gender;
    if (address !== undefined) userPatch.address = address;
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
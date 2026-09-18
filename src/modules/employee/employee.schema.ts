import { z } from "zod";

/**
 * No `password` field anymore — a person's password is only ever set once,
 * at registration (see auth.schema.ts). If this email already belongs to
 * a `users` account, this whole request gets redirected into creating an
 * INVITATION instead (see employee.service.ts) — this schema only ever
 * needs to cover "what if they're brand new."
 */
export const createEmployeeSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(7),
  dob: z.string().min(1),
  gender: z.string().min(1),
  address: z.string().min(4),

  employeeCode: z.string().min(2),
  department: z.string().min(1),
  designation: z.string().min(1),
  role: z.enum(["owner", "admin", "hr", "accountant", "operations", "verifier", "viewer", "employee"]).default("employee"),
  dateOfJoining: z.string().min(1),
  employmentType: z.enum(["Full-time", "Part-time", "Contract"]).default("Full-time"),

  paymentMode: z.enum(["bank", "cash"]).default("bank"),
  bankAccountNumber: z.string().optional(),
  bankIfsc: z.string().optional(),
  bankName: z.string().optional(),
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

/**
 * Splits cleanly along the same line the schema now does: firstName/
 * lastName/phone are the shared person's OWN fields (on `users` — a
 * change here is global, not just "at this company"), everything else is
 * specific to their profile at this one company. `.partial()` makes every
 * field optional since a routine edit usually only touches a few.
 * `role`/`employeeCode` stay excluded — role changes are their own
 * distinct, more tightly-gated action (see updateEmployeeRoleSchema).
 */
export const updateEmployeeSchema = createEmployeeSchema.omit({ email: true, role: true, employeeCode: true }).partial();
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

export const updateEmployeeStatusSchema = z.object({
  status: z.enum(["active", "suspended", "removed"]),
});

export const updateEmployeeRoleSchema = z.object({
  role: z.enum(["owner", "admin", "hr", "accountant", "operations", "verifier", "viewer", "employee"]),
});
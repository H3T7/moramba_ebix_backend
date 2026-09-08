import { z } from "zod";

/**
 * This mirrors the frontend's multi-step Employee form (Personal → Contact
 * → Job & Payment → Review) — all four steps' fields land in one request
 * here, since the wizard only actually submits once, at the end.
 */
export const createEmployeeSchema = z.object({
  employeeCode: z.string().min(2),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),

  phone: z.string().min(7),
  dob: z.string().optional(), // "YYYY-MM-DD"
  gender: z.string().optional(),
  address: z.string().optional(),

  department: z.string().min(1),
  designation: z.string().min(1),
  role: z.enum(["admin", "hr", "accountant", "employee"]).default("employee"),
  dateOfJoining: z.string().min(1),
  employmentType: z.enum(["Full-time", "Part-time", "Contract"]).default("Full-time"),

  paymentMode: z.enum(["bank", "cash"]).default("bank"),
  bankAccountNumber: z.string().optional(),
  bankIfsc: z.string().optional(),
  bankName: z.string().optional(),
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

/**
 * `.partial()` makes every field optional — editing an employee usually
 * only changes a few fields, not all of them. Notably `password` and
 * `role`/`employeeCode` are left OUT entirely: changing your password is a
 * separate, more sensitive flow (not built yet), and role changes are
 * deliberately a distinct action too (see updateEmployeeRoleSchema) so it's
 * never accidentally bundled into a routine profile edit.
 */
export const updateEmployeeSchema = createEmployeeSchema
  .omit({ password: true, role: true, employeeCode: true })
  .partial();
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

export const updateEmployeeStatusSchema = z.object({
  status: z.enum(["active", "inactive"]),
});

export const updateEmployeeRoleSchema = z.object({
  role: z.enum(["admin", "hr", "accountant", "employee"]),
});

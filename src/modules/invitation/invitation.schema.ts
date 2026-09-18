import { z } from "zod";

export const membershipRoles = ["owner", "admin", "hr", "accountant", "operations", "verifier", "viewer", "employee"] as const;

export const createInvitationSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(membershipRoles),
  department: z.string().optional(),
  designation: z.string().optional(),
  phone: z.string().optional(),
  dob: z.string().optional(),
  gender: z.string().optional(),
  address: z.string().optional(),

  // Milestone 12 revision: an invitation now carries the same job/payment
  // details the "Add employee" form collects, so acceptInvitation() can
  // actually set them on the real `employees` row — see
  // employee.service.ts's createEmployee(), which now routes EVERY new
  // employee (new email or existing) through an invitation, never a
  // direct-active employee row. All optional here because the separate
  // "invite someone to this company" flow (Company > Invitations page)
  // doesn't collect these and shouldn't be forced to.
  employeeCode: z.string().optional(),
  dateOfJoining: z.string().optional(),
  employmentType: z.enum(["Full-time", "Part-time", "Contract"]).optional(),
  paymentMode: z.enum(["bank", "cash"]).optional(),
  bankAccountNumber: z.string().optional(),
  bankIfsc: z.string().optional(),
  bankName: z.string().optional(),
});
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
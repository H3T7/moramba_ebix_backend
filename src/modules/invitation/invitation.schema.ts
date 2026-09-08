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
});
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

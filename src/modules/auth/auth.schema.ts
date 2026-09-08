import { z } from "zod";

/**
 * Why validate with zod on the backend too, if the frontend already does?
 * The frontend's validation is for a *friendly UI experience* (instant
 * feedback as someone types). It runs in the user's browser, which means
 * a user (or an attacker) can bypass it completely by calling the API
 * directly. The backend's validation is what actually protects your data
 * — never trust input that crosses a network boundary.
 */

/**
 * companyId and every other field below are now OPTIONAL — "User account
 * != Company membership." A self-registering person (POST /api/auth/register
 * with none of the optional fields) gets a real Moramba account with zero
 * companies; they only gain access to one by accepting an invitation later
 * (see the invitations module). companyId is still accepted here too,
 * since it's also how an Admin-invited person who accepts immediately gets
 * their first company set as their "home" record — see auth.service.ts.
 */
export const registerSchema = z.object({
  companyId: z.string().uuid("companyId must be a valid company ID").optional(),
  employeeCode: z.string().min(2).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().min(7).optional(),
  department: z.string().min(1).optional(),
  designation: z.string().min(1).optional(),
  dateOfJoining: z.string().min(1).optional(), // "YYYY-MM-DD"
  role: z.enum(["admin", "hr", "accountant", "employee"]).default("employee"),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

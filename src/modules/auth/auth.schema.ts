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
 * Registration creates a `users` row ONLY — nothing company-related at
 * all. "User account != Company membership" is now structurally true, not
 * just a rule we remember to follow: `users` has no companyId column to
 * even accept one (see db/schema/users.ts). Joining a company always
 * happens afterward, either by creating one (becoming its Owner — see the
 * company module) or accepting an invitation (see the invitation module),
 * both of which create the actual `employees` row.
 */
export const registerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z.string().min(7).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

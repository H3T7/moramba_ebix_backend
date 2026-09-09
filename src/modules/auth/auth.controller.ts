import type { Request, Response } from "express";
import { registerSchema, loginSchema } from "./auth.schema.js";
import { registerUser, loginUser, getUserById } from "./auth.service.js";
import { AppError } from "../../middleware/errorHandler.js";

/**
 * Notice these functions are `async` and DON'T have try/catch blocks.
 * If `registerSchema.parse()` throws (bad input) or `registerUser()`
 * throws (e.g. AppError for a duplicate email), Express 5 automatically
 * catches that rejected promise and forwards it to our error-handling
 * middleware (src/middleware/errorHandler.ts). That's what keeps these
 * controllers so short.
 *
 * The JSON response key is kept as `employee` (not `user`) on purpose,
 * even though the underlying service now works entirely in terms of the
 * new `users` table — the frontend already has many call sites reading
 * `response.employee`, and renaming the wire format is a separate,
 * mechanical cleanup that doesn't need to happen in the same pass as the
 * actual data-model fix. Internally, everything is users/employees now;
 * externally, the response SHAPE is unchanged.
 */

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  const result = await registerUser(input);
  res.status(201).json({ token: result.token, employee: result.user });
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const result = await loginUser(input);
  res.status(200).json({ token: result.token, employee: result.user, accessibleCompanies: result.accessibleCompanies });
}

export async function me(req: Request, res: Response) {
  // requireAuth (the middleware) already ran before this and guarantees
  // req.user exists — but we double-check to keep TypeScript happy and
  // fail loudly if that assumption is ever wrong.
  if (!req.user) throw new AppError(401, "Not signed in.");
  const result = await getUserById(req.user.sub);
  res.status(200).json({ employee: result.user, accessibleCompanies: result.accessibleCompanies });
}

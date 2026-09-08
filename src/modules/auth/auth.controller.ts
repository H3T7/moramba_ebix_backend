import type { Request, Response } from "express";
import { registerSchema, loginSchema } from "./auth.schema.js";
import { registerEmployee, loginEmployee, getEmployeeById } from "./auth.service.js";
import { AppError } from "../../middleware/errorHandler.js";

/**
 * Notice these functions are `async` and DON'T have try/catch blocks.
 * If `registerSchema.parse()` throws (bad input) or `registerEmployee()`
 * throws (e.g. AppError for a duplicate email), Express 5 automatically
 * catches that rejected promise and forwards it to our error-handling
 * middleware (src/middleware/errorHandler.ts). That's what keeps these
 * controllers so short.
 */

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  const result = await registerEmployee(input);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const result = await loginEmployee(input);
  res.status(200).json(result);
}

export async function me(req: Request, res: Response) {
  // requireAuth (the middleware) already ran before this and guarantees
  // req.user exists — but we double-check to keep TypeScript happy and
  // fail loudly if that assumption is ever wrong.
  if (!req.user) throw new AppError(401, "Not signed in.");
  const result = await getEmployeeById(req.user.sub);
  res.status(200).json(result);
}

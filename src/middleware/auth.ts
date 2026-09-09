import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db/client.js";
import { verifyToken, type UserTokenPayload, type VerifierTokenPayload } from "../lib/jwt.js";
import { AppError } from "./errorHandler.js";
import type { Employee } from "@prisma/client";

// Augment Express's Request type so `req.user`/`req.verifier`/`req.employee`
// are recognized by TypeScript everywhere, fully typed, with no `any`.
declare global {
  namespace Express {
    interface Request {
      user?: UserTokenPayload;
      verifier?: VerifierTokenPayload;
      /** Set by requireCompanyRole once it resolves which company this request is acting on — the caller's own row in `employees` for THAT company. */
      employee?: Employee;
    }
  }
}

/**
 * Reads the "Authorization: Bearer <token>" header, verifies it, and
 * attaches the decoded payload to `req.user`. Any route that needs a
 * logged-in user puts this in front of it:
 *
 *   router.get("/me", requireAuth, meController)
 *
 * If the token is missing or invalid, we throw before the real route
 * handler ever runs. Note this ONLY confirms "this is a real, signed-in
 * person" — it says nothing about which companies they belong to or what
 * role they hold anywhere. That's requireCompanyRole's job, below.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    throw new AppError(401, "You must be signed in to do that.");
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = verifyToken<UserTokenPayload>(token);
    if (payload.type !== "user") {
      throw new AppError(401, "Invalid session for this area.");
    }
    req.user = payload;
    next();
  } catch {
    throw new AppError(401, "Your session is invalid or has expired. Please sign in again.");
  }
}

/**
 * "owner" satisfies anywhere "admin" is required — an Owner is strictly
 * more privileged than an Admin, so requiring one shouldn't lock the other
 * out. Every other role only satisfies an exact match.
 */
function roleSatisfies(actualRole: string, requiredRole: string): boolean {
  if (actualRole === requiredRole) return true;
  if (requiredRole === "admin" && actualRole === "owner") return true;
  return false;
}

/**
 * THE core RBAC gate, and the reason it looks nothing like the old
 * `requireRole` — role used to be a single claim baked into the JWT at
 * login, back when "employee" doubled as both a person's identity AND
 * their one-and-only role. Neither is true anymore (see db/schema/users.ts
 * and employees.ts): a person is a `user`, and holds a COMPLETELY
 * SEPARATE role at every company they belong to. There is no such thing
 * as "this user's role" without first asking "...at which company?" — so
 * this middleware resolves it fresh from the database on every request,
 * for the specific company the request is actually about, rather than
 * trusting a claim that could be stale or simply not apply to this company
 * at all.
 *
 * `companyId` is a function so each route can say exactly where to find
 * the company being acted on:
 *   - Most collection routes have it directly in the URL:
 *       requireCompanyRole((req) => req.params.companyId, "admin")
 *   - Routes addressed by a resource's own :id need to look the resource
 *     up first to find ITS companyId — see e.g. invoice.routes.ts for a
 *     resolver that fetches the invoice, then reads its companyId.
 */
export function requireCompanyRole(companyId: (req: Request) => string | Promise<string>, ...allowedRoles: string[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new AppError(401, "You must be signed in to do that.");

    const resolvedCompanyId = await companyId(req);
    if (!resolvedCompanyId) throw new AppError(404, "Couldn't determine which company this request is for.");

    const membership = await prisma.employee.findFirst({
      where: { userId: req.user.sub, companyId: resolvedCompanyId, status: "active" },
    });

    if (!membership || !allowedRoles.some((r) => roleSatisfies(membership.role, r))) {
      throw new AppError(403, "You don't have permission to do that.");
    }

    req.employee = membership;
    next();
  };
}

/** Shorthand for the common case: the company id is already a URL param named `companyId`. */
export function requireCompanyParamRole(...allowedRoles: string[]) {
  return requireCompanyRole((req) => req.params.companyId as string, ...allowedRoles);
}

/**
 * The other common case: the URL only has a resource's OWN :id (e.g.
 * `/api/customers/:id`), so we have to fetch that resource first to find
 * out which company it even belongs to, before we can check anyone's role
 * there. `finder` is just "how to look this specific table up by id" —
 * each module passes its own, since every table's shape differs.
 */
export function companyIdFromRecord<T extends { companyId: string }>(
  finder: (id: string) => Promise<T | undefined | null>,
  notFoundMessage = "Resource not found."
) {
  return async (req: Request) => {
    const record = await finder(req.params.id as string);
    if (!record) throw new AppError(404, notFoundMessage);
    return record.companyId;
  };
}

/**
 * The Verifier Portal's own gate — deliberately a completely separate
 * function from requireAuth, not a role check layered on top of it. A
 * verifier token has `type: "verifier"` and is rejected here just like a
 * user token is rejected by requireAuth's own type check — neither realm's
 * token is ever valid for the other's routes. This is what keeps the two
 * logins genuinely isolated, matching the frontend's "Verification Portal
 * is a separate world" design.
 */
export function requireVerifierAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    throw new AppError(401, "You must be signed in to do that.");
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = verifyToken<VerifierTokenPayload>(token);
    if (payload.type !== "verifier") {
      throw new AppError(401, "Invalid session for this area.");
    }
    req.verifier = payload;
    next();
  } catch {
    throw new AppError(401, "Your session is invalid or has expired. Please sign in again.");
  }
}

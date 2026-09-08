import type { Request, Response, NextFunction } from "express";
import { verifyToken, type AuthTokenPayload, type VerifierTokenPayload } from "../lib/jwt.js";
import { AppError } from "./errorHandler.js";

// Augment Express's Request type so `req.user`/`req.verifier` are
// recognized by TypeScript everywhere, fully typed, with no `any`. Two
// separate fields on purpose — an employee token and a verifier token
// carry different shapes and are never valid for each other's routes.
declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
      verifier?: VerifierTokenPayload;
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
 * handler ever runs.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    throw new AppError(401, "You must be signed in to do that.");
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = verifyToken<AuthTokenPayload>(token);
    if (payload.type !== "employee") {
      throw new AppError(401, "Invalid session for this area.");
    }
    req.user = payload;
    next();
  } catch {
    throw new AppError(401, "Your session is invalid or has expired. Please sign in again.");
  }
}

/**
 * Role-based access control (RBAC), the same idea as the frontend's
 * `canAccess(role, section)` check — but enforced here too. This matters:
 * the frontend hiding a button is just good UX, but a determined user
 * could call the API directly with curl/Postman and skip the frontend
 * entirely. The backend is the REAL gate; the frontend is a convenience.
 *
 * Usage:  router.delete("/:id", requireAuth, requireRole("admin"), ...)
 */
export function requireRole(...allowedRoles: AuthTokenPayload["role"][]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      throw new AppError(403, "You don't have permission to do that.");
    }
    next();
  };
}

/**
 * The Verifier Portal's own gate — deliberately a completely separate
 * function from requireAuth, not a role check layered on top of it. A
 * verifier token has `type: "verifier"` and is rejected here just like an
 * employee token is rejected by requireAuth's own type check — neither
 * realm's token is ever valid for the other's routes. This is what keeps
 * the two logins genuinely isolated, matching the frontend's "Verification
 * Portal is a separate world" design.
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

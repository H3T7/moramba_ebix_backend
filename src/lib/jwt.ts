import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

/**
 * WHAT IS A JWT AND WHY USE ONE?
 * --------------------------------
 * HTTP is "stateless" — the server doesn't automatically remember who you
 * are between requests. Something has to prove your identity on every
 * request. Two common approaches:
 *
 *   1. Sessions: server generates a random ID, stores it in a database
 *      table, and gives the browser that ID in a cookie. Every request,
 *      the server looks the ID up in that table to find out who you are.
 *
 *   2. JWTs (JSON Web Tokens): the server packs your identity (user id,
 *      role, etc.) directly INTO a signed token and hands it to the
 *      client. The client sends that token back on every request. The
 *      server verifies the SIGNATURE (using JWT_SECRET) to prove the
 *      token hasn't been tampered with — no database lookup needed.
 *
 * We're using JWTs here because they're simple, need no extra database
 * table, and work naturally for a frontend SPA that just attaches an
 * "Authorization: Bearer <token>" header to its API calls.
 *
 * The tradeoff: a JWT can't be "revoked" early the way a session can
 * (short of maintaining a blocklist) — that's why we give tokens a
 * limited lifetime (JWT_EXPIRES_IN, e.g. 7 days) instead of forever.
 */

// Everything we choose to pack inside the token. Keep this small — it's
// sent on every request. Never put a password (or its hash) in here.
//
// Deliberately NO role here anymore. Role used to live on this token
// because "employee" used to BE the login identity. Now that a user can
// belong to many companies with a DIFFERENT role at each (see
// db/schema/employees.ts), there's no single role that would even make
// sense to bake into a token that isn't scoped to one company — role is
// resolved fresh, per request, per company (see requireCompanyRole in
// middleware/auth.ts), never trusted from an old, possibly-stale claim.
export type UserTokenPayload = {
  sub: string; // "subject" — the standard JWT field for "whose token is this"
  type: "user"; // distinguishes company-workspace tokens from verifier tokens
};

export type VerifierTokenPayload = {
  sub: string;
  type: "verifier";
};

export function signUserToken(payload: UserTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });
}

export function signVerifierToken(payload: VerifierTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });
}

/** Throws if the token is missing, expired, or the signature doesn't match. */
export function verifyToken<T>(token: string): T {
  return jwt.verify(token, env.JWT_SECRET) as T;
}

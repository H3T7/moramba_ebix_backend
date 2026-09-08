import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { verifiers } from "../../db/schema/index.js";
import { verifyPassword } from "../../lib/password.js";
import { signVerifierToken } from "../../lib/jwt.js";
import { AppError } from "../../middleware/errorHandler.js";
import type { VerifierLoginInput } from "./verifierAuth.schema.js";

// Same "never leak the hash" pattern as auth.service.ts's toPublicEmployee.
function toPublicVerifier(row: typeof verifiers.$inferSelect) {
  const { passwordHash, ...safe } = row;
  return safe;
}

export async function loginVerifier(input: VerifierLoginInput) {
  const verifier = await db.query.verifiers.findFirst({ where: eq(verifiers.email, input.email) });

  // Same generic message whether the email doesn't exist or the password
  // is wrong — see auth.service.ts's loginEmployee for why (prevents
  // user enumeration).
  const invalid = () => new AppError(401, "Invalid email or password.");
  if (!verifier) throw invalid();

  const passwordOk = await verifyPassword(input.password, verifier.passwordHash);
  if (!passwordOk) throw invalid();

  const token = signVerifierToken({ sub: verifier.id, type: "verifier" });
  return { token, verifier: toPublicVerifier(verifier) };
}

export async function getVerifierById(id: string) {
  const verifier = await db.query.verifiers.findFirst({ where: eq(verifiers.id, id) });
  if (!verifier) throw new AppError(404, "Verifier not found.");
  return toPublicVerifier(verifier);
}

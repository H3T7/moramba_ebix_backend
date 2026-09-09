import { prisma } from "../../db/client.js";
import { verifyPassword } from "../../lib/password.js";
import { signVerifierToken } from "../../lib/jwt.js";
import { AppError } from "../../middleware/errorHandler.js";
import type { VerifierLoginInput } from "./verifierAuth.schema.js";
import type { Verifier } from "@prisma/client";

function toPublicVerifier(row: Verifier) {
  const { passwordHash, ...safe } = row;
  return safe;
}

export async function loginVerifier(input: VerifierLoginInput) {
  const verifier = await prisma.verifier.findUnique({ where: { email: input.email } });

  const invalid = () => new AppError(401, "Invalid email or password.");
  if (!verifier) throw invalid();

  const passwordOk = await verifyPassword(input.password, verifier.passwordHash);
  if (!passwordOk) throw invalid();

  const token = signVerifierToken({ sub: verifier.id, type: "verifier" });
  return { token, verifier: toPublicVerifier(verifier) };
}

export async function getVerifierById(id: string) {
  const verifier = await prisma.verifier.findUnique({ where: { id } });
  if (!verifier) throw new AppError(404, "Verifier not found.");
  return toPublicVerifier(verifier);
}

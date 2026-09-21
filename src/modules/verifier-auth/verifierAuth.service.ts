import { prisma } from "../../db/client.js";
import { verifyPassword } from "../../lib/password.js";
import { signVerifierToken } from "../../lib/jwt.js";
import { AppError } from "../../middleware/errorHandler.js";
import type { VerifierLoginInput } from "./verifierAuth.schema.js";
import type { User, Verifier } from "@prisma/client";

/**
 * TWO kinds of people use the Verification Portal:
 *
 *  1. Moramba's own verifiers — rows in `verifiers` with their own password,
 *     completely separate from any company. They review EVERY company's documents.
 *
 *  2. Company employees who hold the "verifier" ROLE — added like any other
 *     employee (Employees → Add / an invitation). They sign in with the SAME
 *     email + password as their normal login and can review only the documents
 *     of the company/companies where they hold that role. Each gets a linked
 *     row in `verifiers` (created the first time they open the portal) because
 *     review decisions are recorded against a verifier id.
 *
 * Whether a verifier is company-scoped is decided by `verifiers.userId`.
 */

const invalid = () => new AppError(401, "Invalid email or password.");

/** Every company where this user is an ACTIVE employee with the verifier role. */
async function verifierCompaniesOf(userId: string) {
  const rows = await prisma.employee.findMany({
    where: { userId, role: "verifier", status: "active" },
    include: { company: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => r.company);
}

async function toPublicVerifier(row: Verifier) {
  const { passwordHash, ...safe } = row;
  const companies = row.userId ? await verifierCompaniesOf(row.userId) : [];
  return {
    ...safe,
    // "all" = Moramba's team (every company); "company" = limited to `companies`.
    scope: row.userId ? ("company" as const) : ("all" as const),
    companies,
  };
}

/**
 * Turns a real company user into a portal session, if — and only if — they hold
 * the verifier role somewhere. The linked `verifiers` row is created/refreshed
 * here so the person's name always matches their account.
 */
async function issueSessionForUser(user: User, onNoRole: () => AppError) {
  const companies = await verifierCompaniesOf(user.id);
  if (companies.length === 0) throw onNoRole();

  const verifier = await prisma.verifier.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      // Never used to sign in (a linked verifier authenticates as their USER);
      // the column just can't be empty.
      passwordHash: user.passwordHash,
      specialization: "Company verifier",
    },
    update: { name: `${user.firstName} ${user.lastName}`.trim(), email: user.email },
  });

  const token = signVerifierToken({ sub: verifier.id, type: "verifier" });
  return { token, verifier: await toPublicVerifier(verifier) };
}

export async function loginVerifier(input: VerifierLoginInput) {
  const email = input.email.trim().toLowerCase();

  // 1. One of Moramba's own verifiers?
  const own = await prisma.verifier.findFirst({ where: { email: { equals: email, mode: "insensitive" }, userId: null } });
  if (own) {
    if (!(await verifyPassword(input.password, own.passwordHash))) throw invalid();
    const token = signVerifierToken({ sub: own.id, type: "verifier" });
    return { token, verifier: await toPublicVerifier(own) };
  }

  // 2. A company employee with the verifier role — same credentials as their normal login.
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) throw invalid();
  // Same message as a wrong password: the portal shouldn't reveal which accounts exist or what roles they hold.
  return issueSessionForUser(user, invalid);
}

/**
 * Someone already signed in to the company workspace (a user token) gets a
 * portal session without typing their password again — this is what a normal
 * login uses to send a verifier-role employee straight into the portal.
 */
export async function exchangeSessionForVerifier(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(401, "Your session is invalid or has expired. Please sign in again.");
  return issueSessionForUser(user, () => new AppError(403, "You don't hold the Verifier role at any company."));
}

export async function getVerifierById(id: string) {
  const verifier = await prisma.verifier.findUnique({ where: { id } });
  if (!verifier) throw new AppError(404, "Verifier not found.");
  return toPublicVerifier(verifier);
}

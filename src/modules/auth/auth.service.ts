import { prisma } from "../../db/client.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { signUserToken } from "../../lib/jwt.js";
import { AppError } from "../../middleware/errorHandler.js";
import type { RegisterInput, LoginInput } from "./auth.schema.js";
import type { User } from "@prisma/client";

function toPublicUser(row: User) {
  const { passwordHash, ...safe } = row;
  return safe;
}

export async function registerUser(input: RegisterInput) {
  const email = input.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, "An account with that email already exists.");
  }

  const passwordHash = await hashPassword(input.password);

  const created = await prisma.user.create({
    data: { email, passwordHash, firstName: input.firstName, lastName: input.lastName, phone: input.phone },
  });

  const token = signUserToken({ sub: created.id, type: "user" });

  return { token, user: toPublicUser(created) };
}

export async function loginUser(input: LoginInput) {
  const email = input.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  const invalid = () => new AppError(401, "Invalid email or password.");

  if (!user) throw invalid();

  const passwordOk = await verifyPassword(input.password, user.passwordHash);
  if (!passwordOk) throw invalid();

  const token = signUserToken({ sub: user.id, type: "user" });
  const accessibleCompanies = await getAccessibleCompanies(user.id);

  return { token, user: toPublicUser(user), accessibleCompanies };
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, "User not found.");

  const accessibleCompanies = await getAccessibleCompanies(id);
  return { user: toPublicUser(user), accessibleCompanies };
}

/**
 * Only ACTIVE employees rows count as "accessible." Each company comes
 * back with the person's OWN role AND their employees.id (their profile
 * row at that specific company) attached, since plenty of other tables
 * need to reference that specific row.
 */
export async function getAccessibleCompanies(userId: string) {
  const rows = await prisma.employee.findMany({
    where: { userId, status: "active" },
    include: { company: true },
  });

  return rows.map((r) => ({ ...r.company, role: r.role, employeeId: r.id }));
}

import { AppError } from "../middleware/errorHandler.js";

/**
 * The Prisma `EmploymentType` enum uses `@map(...)` to store hyphenated
 * text in Postgres ("Full-time") while the generated JS/TS enum itself
 * uses the un-mapped key ("FullTime") — Prisma Client validates against
 * that key, NOT the mapped DB string. The frontend (and this API's Zod
 * schemas) speak the human-readable, hyphenated form throughout, so every
 * write path needs to translate through this map right before it touches
 * Prisma — never pass a raw "Full-time"-style string straight through.
 *
 * Shared here (not duplicated in employee.service.ts and
 * invitation.service.ts separately) because BOTH now write an
 * `employmentType` value to the database: employee.service.ts on direct
 * employee edits, invitation.service.ts when a new invitation is created
 * (see Milestone 12 revision — invitations now carry the job/payment
 * details an Admin filled in, not just role/department/designation).
 */
const EMPLOYMENT_TYPE_TO_PRISMA: Record<string, "FullTime" | "PartTime" | "Contract"> = {
  "Full-time": "FullTime",
  "Part-time": "PartTime",
  "Contract": "Contract",
};

export function mapEmploymentType(value: string) {
  const mapped = EMPLOYMENT_TYPE_TO_PRISMA[value];
  if (!mapped) throw new AppError(400, `Invalid employment type: ${value}`);
  return mapped;
}

/**
 * The reverse of the map above — translates a Prisma enum key ("FullTime")
 * back to the hyphenated form ("Full-time") the frontend's <select> options
 * and Zod schemas actually use. Every read path that returns an
 * `employmentType` straight from Prisma (employee.service.ts's
 * toPublicEmployee, invitation reads, etc.) needs to run it through this —
 * otherwise the API accepts "Full-time" on write but echoes back "FullTime"
 * on read, which silently breaks the edit form's dropdown (none of its
 * options match "FullTime", so it renders blank even though the value is
 * really set).
 */
const PRISMA_TO_EMPLOYMENT_TYPE: Record<string, string> = {
  FullTime: "Full-time",
  PartTime: "Part-time",
  Contract: "Contract",
};

export function mapEmploymentTypeFromPrisma(value: string | null | undefined) {
  if (!value) return value;
  return PRISMA_TO_EMPLOYMENT_TYPE[value] ?? value;
}
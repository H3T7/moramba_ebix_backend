/**
 * WHY THIS FILE EXISTS
 * ---------------------
 * A handful of enum values contain spaces or hyphens ("Documents Pending",
 * "Pay Advance", "Full-time", "In Transit"...) — valid as Postgres enum
 * values, but NOT valid as Prisma enum identifiers (Prisma's schema DSL
 * requires plain identifier syntax). schema.prisma maps each of those to a
 * clean identifier with `@map("...")` — e.g. `DocumentsPending @map("Documents Pending")`.
 *
 * That `@map` ONLY affects the underlying database column value — the
 * Prisma CLIENT (both reading and writing) always speaks in terms of the
 * clean identifier (`"DocumentsPending"`), never the original string.
 *
 * The REST API, meanwhile, still speaks the ORIGINAL strings — that's
 * what the existing, already-tested frontend sends and expects back (zod
 * schemas validate against `"Documents Pending"`, not `"DocumentsPending"`).
 * These maps are the translation layer at that boundary: convert the raw
 * API string to the Prisma identifier right before a Prisma call, and back
 * again... except conversion back isn't actually needed, because Prisma
 * Client automatically returns records with the ORIGINAL `@map`-ed string
 * already (Prisma translates DB -> client using the `@map` value
 * automatically on reads) — this file is only needed for the
 * WRITE/FILTER direction: API string -> Prisma identifier.
 */

export const transactionStatusToPrisma: Record<string, string> = {
  Draft: "Draft",
  Submitted: "Submitted",
  Processing: "Processing",
  "Documents Pending": "DocumentsPending",
  Ready: "Ready",
  Completed: "Completed",
  Cancelled: "Cancelled",
};

export const paymentTermsToPrisma: Record<string, string> = {
  "Pay Advance": "PayAdvance",
  "Pay Later": "PayLater",
  "Letter of Credit": "LetterOfCredit",
  "50% Advance / 50% on Shipment": "FiftyFiftyShipment",
};

export const documentStatusToPrisma: Record<string, string> = {
  "Pending Verification": "PendingVerification",
  "Under Review": "UnderReview",
  Verified: "Verified",
  Rejected: "Rejected",
  "Requires Changes": "RequiresChanges",
};

export const shipmentStatusToPrisma: Record<string, string> = {
  Preparing: "Preparing",
  "In Transit": "InTransit",
  Customs: "Customs",
  Delivered: "Delivered",
  Delayed: "Delayed",
  Cancelled: "Cancelled",
};

export const employmentTypeToPrisma: Record<string, string> = {
  "Full-time": "FullTime",
  "Part-time": "PartTime",
  Contract: "Contract",
};

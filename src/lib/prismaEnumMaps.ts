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
 * These maps are the translation layer at that boundary: `*ToPrisma`
 * converts the raw API string to the Prisma identifier right before a
 * write, and `*FromPrisma` (below the four `*ToPrisma` maps) converts back
 * on the way out. Both directions are needed — see the correction note
 * further down for why "just returns the mapped string automatically"
 * was wrong.
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

/**
 * CORRECTION to this file's header comment above: reading a record back
 * from Prisma Client does NOT automatically give you the original
 * `@map`-ed string. `@map` on an enum member only renames the value
 * actually stored in the database column — the Prisma Client's JS/TS
 * value is always the enum member's DECLARED NAME (e.g. "PayAdvance"),
 * never the mapped string ("Pay Advance"). This was previously assumed
 * to "just work" and wasn't — every GET response was silently returning
 * the unspaced Prisma identifier, which doesn't match any option in the
 * frontend's <select> (built from the same spaced strings the *ToPrisma
 * maps above use), so payment-terms/status fields looked blank on the
 * edit form even though the real value was saved correctly.
 *
 * These are the reverse of the four maps above — run every enum field
 * through the matching one of these before sending a Prisma row out over
 * the API. Falls back to the raw value if it's somehow not a known key,
 * so an unexpected value degrades to "shown as-is" rather than vanishing.
 */
function invert(map: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));
}
const transactionStatusFromPrismaMap = invert(transactionStatusToPrisma);
const paymentTermsFromPrismaMap = invert(paymentTermsToPrisma);
const documentStatusFromPrismaMap = invert(documentStatusToPrisma);
const shipmentStatusFromPrismaMap = invert(shipmentStatusToPrisma);

export function transactionStatusFromPrisma(value: string | null | undefined) {
  if (!value) return value;
  return transactionStatusFromPrismaMap[value] ?? value;
}
export function paymentTermsFromPrisma(value: string | null | undefined) {
  if (!value) return value;
  return paymentTermsFromPrismaMap[value] ?? value;
}
export function documentStatusFromPrisma(value: string | null | undefined) {
  if (!value) return value;
  return documentStatusFromPrismaMap[value] ?? value;
}
export function shipmentStatusFromPrisma(value: string | null | undefined) {
  if (!value) return value;
  return shipmentStatusFromPrismaMap[value] ?? value;
}
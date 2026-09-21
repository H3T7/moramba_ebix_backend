import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/client.js";
import { AppError } from "../../middleware/errorHandler.js";
import { documentStatusToPrisma, documentStatusFromPrisma, transactionStatusFromPrisma } from "../../lib/prismaEnumMaps.js";
import { validateUpload, saveFile, deleteStoredFile, deleteStoredFiles, locateStoredFile } from "../../lib/fileStorage.js";
import type { UploadDocumentInput, ReviewDocumentInput, UpdateDocumentMetaInput } from "./document.schema.js";

/**
 * What every document query pulls in alongside the row itself: WHO uploaded
 * it (as a name, so the UI can say "by Priya Shah" instead of showing a
 * bare id) and when the CURRENT version was uploaded (the row's own
 * createdAt never changes when a file is replaced).
 */
const DECISION_STATUSES = ["Verified", "Rejected", "RequiresChanges"] as const;

const documentInclude = {
  uploadedBy: { select: { user: { select: { firstName: true, lastName: true } } } },
  versions: { orderBy: { version: "desc" }, take: 1, select: { uploadedAt: true } },
  // The verifier's NAME (the row only stores their id) and the time of the
  // latest final decision — so every page can say "Approved by Meera Iyer, 2h ago".
  reviewer: { select: { name: true } },
  reviews: { where: { status: { in: [...DECISION_STATUSES] } }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true, version: true } },
} satisfies Prisma.DocumentInclude;

type DocumentRow = Prisma.DocumentGetPayload<{ include: typeof documentInclude }>;

function personName(uploadedBy: { user: { firstName: string; lastName: string } } | null | undefined) {
  return uploadedBy ? `${uploadedBy.user.firstName} ${uploadedBy.user.lastName}`.trim() : null;
}

/**
 * The shape the API returns for a document. Three things happen here:
 *  - `status` is translated from Prisma's unspaced enum identifier
 *    ("PendingVerification") to the spaced string the frontend expects
 *    ("Pending Verification") — same fix as bill/invoice services;
 *  - `storedName` (the on-disk path) is stripped — clients never need it
 *    and it's an internal detail;
 *  - `hasFile` tells the UI whether there's really a file to view/download
 *    (false only for rows created before file storage existed).
 */
function toPublicDoc(doc: DocumentRow) {
  const { storedName, uploadedBy, versions, reviewer, reviews, status, ...rest } = doc;
  const latestDecision = reviews[0];
  return {
    ...rest,
    status: documentStatusFromPrisma(status),
    uploadedBy: personName(uploadedBy),
    uploadedAt: (versions[0]?.uploadedAt ?? doc.createdAt).toISOString(),
    hasFile: Boolean(storedName),
    reviewerName: reviewer?.name ?? null,
    // Only counts if it was a decision on the CURRENT version — uploading a
    // corrected file starts a fresh review, so an old decision must not show.
    reviewedAt: latestDecision && latestDecision.version === doc.version ? latestDecision.createdAt.toISOString() : null,
  };
}

async function assertParentBelongsToCompany(companyId: string, invoiceId?: string, billId?: string) {
  if (invoiceId) {
    const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, companyId } });
    if (!invoice) throw new AppError(404, "That invoice doesn't exist for this company.");
  }
  if (billId) {
    const bill = await prisma.bill.findFirst({ where: { id: billId, companyId } });
    if (!bill) throw new AppError(404, "That bill doesn't exist for this company.");
  }
}

/**
 * Order matters here, on purpose: everything that can be rejected is
 * checked BEFORE the file is written to disk (file type, the parent
 * invoice/bill), and if the database write then fails anyway the file is
 * deleted again — so a failed upload never leaves an orphan file behind.
 *
 * The document row and its first version-history row are inserted inside
 * ONE transaction.
 */
export async function uploadDocument(
  companyId: string,
  uploadedByEmployeeId: string,
  input: UploadDocumentInput,
  file: Express.Multer.File | undefined
) {
  const upload = validateUpload(file);
  await assertParentBelongsToCompany(companyId, input.invoiceId, input.billId);

  const saved = await saveFile(companyId, upload);

  try {
    return await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          companyId,
          invoiceId: input.invoiceId,
          billId: input.billId,
          category: input.category,
          docType: input.docType,
          description: input.description,
          country: input.country,
          fileName: saved.fileName,
          storedName: saved.storedName,
          mimeType: saved.mimeType,
          fileSize: saved.fileSize,
          uploadedByEmployeeId,
          version: 1,
        },
        include: documentInclude,
      });

      await tx.documentVersion.create({
        data: {
          documentId: doc.id,
          version: 1,
          fileName: saved.fileName,
          storedName: saved.storedName,
          mimeType: saved.mimeType,
          fileSize: saved.fileSize,
          uploadedByEmployeeId,
        },
      });

      return toPublicDoc(doc);
    });
  } catch (err) {
    await deleteStoredFile(companyId, saved.storedName);
    throw err;
  }
}

export async function listDocumentsByCompany(companyId: string) {
  const rows = await prisma.document.findMany({ where: { companyId }, include: documentInclude, orderBy: { createdAt: "desc" } });
  return rows.map(toPublicDoc);
}

export async function listDocumentsForTransaction(transactionType: "invoice" | "bill", transactionId: string) {
  const rows = await prisma.document.findMany({
    where: transactionType === "invoice" ? { invoiceId: transactionId } : { billId: transactionId },
    include: documentInclude,
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toPublicDoc);
}

export async function getDocument(id: string) {
  const doc = await prisma.document.findUnique({ where: { id }, include: documentInclude });
  if (!doc) throw new AppError(404, "Document not found.");

  const versions = await prisma.documentVersion.findMany({
    where: { documentId: id },
    orderBy: { version: "desc" },
    include: { uploadedBy: { select: { user: { select: { firstName: true, lastName: true } } } } },
  });
  const history = versions.map((v) => ({
    id: v.id,
    version: v.version,
    fileName: v.fileName,
    mimeType: v.mimeType,
    fileSize: v.fileSize,
    uploadedAt: v.uploadedAt.toISOString(),
    uploadedBy: personName(v.uploadedBy),
    hasFile: Boolean(v.storedName),
    isCurrent: v.version === doc.version,
  }));

  const reviews = await prisma.documentReview.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "desc" },
    include: { verifier: { select: { name: true } } },
  });
  const reviewLog = reviews.map((r) => ({
    id: r.id,
    version: r.version,
    status: documentStatusFromPrisma(r.status),
    comments: r.comments,
    reason: r.reason,
    verifierName: r.verifier.name,
    createdAt: r.createdAt.toISOString(),
  }));

  return { ...toPublicDoc(doc), history, reviews: reviewLog };
}

/** What a company sees at a glance about the invoice/bill a document belongs to — for the Verifier's review screen, which can't call the company-only invoice/bill routes. */
async function transactionSummary(doc: { invoiceId: string | null; billId: string | null }) {
  const total = (items: { quantity: unknown; rate: unknown; taxPercent: unknown }[]) =>
    items.reduce((sum, it) => sum + Number(it.quantity) * Number(it.rate) * (1 + Number(it.taxPercent) / 100), 0).toFixed(2);

  if (doc.invoiceId) {
    const inv = await prisma.invoice.findUnique({ where: { id: doc.invoiceId }, include: { customer: { select: { name: true, country: true } }, items: true } });
    if (!inv) return null;
    const d = (inv.exportDetails ?? {}) as Record<string, unknown>;
    return {
      type: "invoice" as const, id: inv.id, number: inv.invoiceNumber, status: transactionStatusFromPrisma(inv.status), submitted: inv.submitted,
      currency: inv.currency, grandTotal: total(inv.items), partyLabel: "Customer", partyName: inv.customer.name, partyCountry: inv.customer.country,
      originCountry: (d.originCountry as string) ?? null, destinationCountry: (d.destinationCountry as string) ?? null,
    };
  }
  if (doc.billId) {
    const bill = await prisma.bill.findUnique({ where: { id: doc.billId }, include: { vendor: { select: { name: true, country: true } }, items: true } });
    if (!bill) return null;
    const d = (bill.importDetails ?? {}) as Record<string, unknown>;
    return {
      type: "bill" as const, id: bill.id, number: bill.billNumber, status: transactionStatusFromPrisma(bill.status), submitted: bill.submitted,
      currency: bill.currency, grandTotal: total(bill.items), partyLabel: "Vendor", partyName: bill.vendor.name, partyCountry: bill.vendor.country,
      originCountry: (d.originCountry as string) ?? null, destinationCountry: (d.destinationCountry as string) ?? null,
    };
  }
  return null;
}

/**
 * WHO is reviewing, and WHICH companies' documents they may touch.
 * `companyIds === null` means "all of them" (one of Moramba's own verifiers);
 * an array means a company employee holding the verifier role — limited to the
 * companies where they hold it. Loaded fresh on every request, so removing or
 * suspending someone's verifier role takes effect immediately, not when their
 * token expires.
 */
export type VerifierContext = { id: string; companyIds: string[] | null };

export async function loadVerifierContext(verifierId: string): Promise<VerifierContext> {
  const verifier = await prisma.verifier.findUnique({ where: { id: verifierId }, select: { userId: true } });
  if (!verifier) throw new AppError(401, "Your session is invalid or has expired. Please sign in again.");
  if (!verifier.userId) return { id: verifierId, companyIds: null };

  const roles = await prisma.employee.findMany({
    where: { userId: verifier.userId, role: "verifier", status: "active" },
    select: { companyId: true },
  });
  return { id: verifierId, companyIds: roles.map((r) => r.companyId) };
}

/**
 * A document outside a company verifier's scope is reported as NOT FOUND, not
 * "forbidden" — so the response doesn't even confirm that the id exists.
 */
function assertInScope(ctx: VerifierContext, companyId: string) {
  if (ctx.companyIds && !ctx.companyIds.includes(companyId)) throw new AppError(404, "Document not found.");
}

/** The Verifier's view of one document: the normal detail + version history + review log, PLUS which company and which invoice/bill it belongs to. */
export async function getDocumentForVerifier(id: string, ctx: VerifierContext) {
  const owner = await prisma.document.findUnique({ where: { id }, select: { companyId: true } });
  if (!owner) throw new AppError(404, "Document not found.");
  assertInScope(ctx, owner.companyId);
  const base = await getDocument(id);
  const row = await prisma.document.findUnique({ where: { id }, include: { company: { select: { name: true } } } });
  const transaction = await transactionSummary({ invoiceId: base.invoiceId, billId: base.billId });
  return {
    ...base,
    companyName: row?.company.name ?? null,
    transactionNumber: transaction?.number ?? null,
    transactionType: base.invoiceId ? "invoice" : "bill",
    transaction,
  };
}

/**
 * The server-side gate on submitting an invoice/bill: every uploaded document
 * must have been approved by a Verifier, and every document on the required
 * checklist must actually have been uploaded. The UI already hides the button
 * until this is true — this makes it true for the API too, so an approval
 * can't be skipped by anyone calling the route directly.
 */
export async function assertDocumentsApprovedForSubmit(parent: { invoiceId: string } | { billId: string }, requiredDocs: unknown) {
  const docs = await prisma.document.findMany({ where: parent, select: { status: true } });
  const required = Array.isArray(requiredDocs) ? requiredDocs.length : 0;

  if (docs.length === 0) {
    throw new AppError(409, "No documents have been uploaded yet. Upload them so the Verification team can review them before this is submitted.");
  }
  const notApproved = docs.filter((d) => d.status !== "Verified").length;
  if (notApproved > 0) {
    throw new AppError(409, `${notApproved} document${notApproved !== 1 ? "s" : ""} still ${notApproved !== 1 ? "need" : "needs"} approval from the Verification team before this can be submitted.`);
  }
  if (docs.length < required) {
    const missing = required - docs.length;
    throw new AppError(409, `${missing} required document${missing !== 1 ? "s haven't" : " hasn't"} been uploaded yet.`);
  }
}

/**
 * Uploading a corrected file bumps the version and puts the document BACK
 * into "Pending Verification." The previous file is deliberately kept on
 * disk — it stays downloadable from the version history.
 */
export async function replaceDocument(id: string, uploadedByEmployeeId: string, file: Express.Multer.File | undefined) {
  const upload = validateUpload(file);

  const existing = await prisma.document.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Document not found.");

  const saved = await saveFile(existing.companyId, upload);
  const nextVersion = existing.version + 1;

  try {
    return await prisma.$transaction(async (tx) => {
      const updated = await tx.document.update({
        where: { id },
        data: {
          fileName: saved.fileName,
          storedName: saved.storedName,
          mimeType: saved.mimeType,
          fileSize: saved.fileSize,
          uploadedByEmployeeId,
          version: nextVersion,
          status: "PendingVerification",
          reviewerVerifierId: null,
          reviewerComments: null,
          rejectionReason: null,
        },
        include: documentInclude,
      });

      await tx.documentVersion.create({
        data: {
          documentId: id,
          version: nextVersion,
          fileName: saved.fileName,
          storedName: saved.storedName,
          mimeType: saved.mimeType,
          fileSize: saved.fileSize,
          uploadedByEmployeeId,
        },
      });

      return toPublicDoc(updated);
    });
  } catch (err) {
    await deleteStoredFile(existing.companyId, saved.storedName);
    throw err;
  }
}

/**
 * Resolves the file behind a document (its current version, or a specific
 * older one) into the folder + name the controller streams from.
 */
export async function getDocumentFile(id: string, version?: number, verifier?: VerifierContext) {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new AppError(404, "Document not found.");
  if (verifier) assertInScope(verifier, doc.companyId);

  let source: { fileName: string; storedName: string | null; mimeType: string | null } = doc;
  if (version !== undefined && version !== doc.version) {
    const older = await prisma.documentVersion.findFirst({ where: { documentId: id, version } });
    if (!older) throw new AppError(404, `Version ${version} of this document doesn't exist.`);
    source = older;
  }

  if (!source.storedName) {
    throw new AppError(404, "No file was stored for this document (it was created before file uploads were enabled). Upload the file again to attach it.");
  }

  const { dir, storedName } = await locateStoredFile(doc.companyId, source.storedName);
  return { dir, storedName, fileName: source.fileName, mimeType: source.mimeType ?? "application/octet-stream" };
}

const DECISION_STATUS = {
  approve: "Verified",
  reject: "Rejected",
  request_changes: "RequiresChanges",
} as const;

/**
 * The Verifier picks a document up: Pending -> Under Review, assigned to them,
 * so the company can see it has been seen and by whom. A no-op if it's already
 * under review or decided — opening a document to LOOK at it must never
 * disturb a decision someone else already made.
 */
export async function startReview(id: string, ctx: VerifierContext) {
  const verifierId = ctx.id;
  const existing = await prisma.document.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Document not found.");
  assertInScope(ctx, existing.companyId);

  if (existing.status === "PendingVerification") {
    await prisma.$transaction(async (tx) => {
      await tx.document.update({ where: { id }, data: { status: "UnderReview", reviewerVerifierId: verifierId } });
      await tx.documentReview.create({ data: { documentId: id, verifierId, version: existing.version, status: "UnderReview" } });
    });
  }
  const fresh = await prisma.document.findUnique({ where: { id }, include: documentInclude });
  return toPublicDoc(fresh!);
}

/** This is the Verifier's decision, gated by requireVerifierAuth (a completely separate identity realm from employees). */
export async function reviewDocument(id: string, ctx: VerifierContext, input: ReviewDocumentInput) {
  const reviewerVerifierId = ctx.id;
  const existing = await prisma.document.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Document not found.");
  assertInScope(ctx, existing.companyId);

  const status = DECISION_STATUS[input.decision];
  // For a rejection AND a change request the reason is what the uploader is
  // shown next to the document, so both keep it (a change request used to lose it).
  const reason = input.decision === "approve" ? null : input.rejectionReason ?? input.comments ?? null;

  const updated = await prisma.$transaction(async (tx) => {
    // The audit row goes in FIRST: the update below reads it back (for
    // `reviewedAt`) as part of building the response.
    await tx.documentReview.create({
      data: { documentId: id, verifierId: reviewerVerifierId, version: existing.version, status, comments: input.comments, reason },
    });
    return tx.document.update({
      where: { id },
      data: { status, reviewerVerifierId, reviewerComments: input.comments, rejectionReason: reason },
      include: documentInclude,
    });
  });
  return toPublicDoc(updated);
}

/**
 * Patches docType/description WITHOUT touching fileName/version/status —
 * this is what an edit form should call when the person only changed a
 * document's label or note and re-picked the exact same file, so it
 * doesn't create a confusing duplicate document row the way re-running
 * uploadDocument would (that's a genuinely new file, a new version,
 * needs re-verification; this is neither).
 */
export async function updateDocumentMeta(id: string, input: UpdateDocumentMetaInput) {
  const updated = await prisma.document
    .update({ where: { id }, data: { docType: input.docType, description: input.description }, include: documentInclude })
    .catch(() => null);
  if (!updated) throw new AppError(404, "Document not found.");
  return toPublicDoc(updated);
}

/** Every file on disk belonging to a document — the current one AND all older versions. */
async function storedFilesForWhere(where: Prisma.DocumentWhereInput) {
  const docs = await prisma.document.findMany({
    where,
    select: { companyId: true, storedName: true, versions: { select: { storedName: true } } },
  });
  return docs.flatMap((d) => [d.storedName, ...d.versions.map((v) => v.storedName)].filter((n): n is string => Boolean(n)).map((storedName) => ({ companyId: d.companyId, storedName })));
}

/**
 * Called by invoice/bill deletion: the database cascades and removes the
 * document ROWS, but only this can remove the FILES. Collect first, delete
 * the parent, then call `deleteStoredFiles` with what this returned.
 */
export function listStoredFilesForParent(parent: { invoiceId: string } | { billId: string }) {
  return storedFilesForWhere(parent);
}
export { deleteStoredFiles };

export async function deleteDocument(id: string) {
  const files = await storedFilesForWhere({ id });
  const deleted = await prisma.document.delete({ where: { id } }).catch(() => null);
  if (!deleted) throw new AppError(404, "Document not found.");
  await deleteStoredFiles(files);
  return { id: deleted.id };
}

/**
 * The Verifier queue — every document across EVERY company, joined with
 * the parent invoice/bill's number and the company's name so the queue is
 * actually readable, not just a bare list of file names and UUIDs.
 */
export async function listVerifierQueue(ctx: VerifierContext, status?: string) {
  const rows = await prisma.document.findMany({
    where: {
      ...(status ? { status: documentStatusToPrisma[status] as never } : {}),
      // A company's verifier sees only their own company's documents.
      ...(ctx.companyIds ? { companyId: { in: ctx.companyIds } } : {}),
    },
    include: { ...documentInclude, company: true, invoice: { select: { invoiceNumber: true } }, bill: { select: { billNumber: true } } },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((r) => {
    const { company, invoice, bill, ...doc } = r;
    return {
      ...toPublicDoc(doc),
      companyName: company.name,
      transactionNumber: invoice?.invoiceNumber ?? bill?.billNumber,
      transactionType: invoice ? "invoice" : "bill",
    };
  });
}

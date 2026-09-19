import { prisma } from "../../db/client.js";
import { AppError } from "../../middleware/errorHandler.js";
import { documentStatusToPrisma, documentStatusFromPrisma } from "../../lib/prismaEnumMaps.js";
import type { UploadDocumentInput, ReviewDocumentInput, UpdateDocumentMetaInput } from "./document.schema.js";

// Same fix as bill.service.ts/invoice.service.ts's withPublicEnums — Prisma
// always returns `status` as its unspaced enum identifier
// ("PendingVerification"), never the spaced string the frontend actually
// expects ("Pending Verification"). Every function below that returns a
// document row runs it through this.
function withPublicDocStatus<T extends { status: string }>(doc: T) {
  return { ...doc, status: documentStatusFromPrisma(doc.status) };
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
 * Uploading and its first version-history row are inserted inside ONE
 * transaction.
 */
export async function uploadDocument(companyId: string, uploadedByEmployeeId: string, input: UploadDocumentInput) {
  await assertParentBelongsToCompany(companyId, input.invoiceId, input.billId);

  return prisma.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        companyId,
        invoiceId: input.invoiceId,
        billId: input.billId,
        category: input.category,
        docType: input.docType,
        description: input.description,
        country: input.country,
        fileName: input.fileName,
        uploadedByEmployeeId,
        version: 1,
      },
    });

    await tx.documentVersion.create({
      data: { documentId: doc.id, version: 1, fileName: input.fileName, uploadedByEmployeeId },
    });

    return withPublicDocStatus(doc);
  });
}

export async function listDocumentsByCompany(companyId: string) {
  const rows = await prisma.document.findMany({ where: { companyId } });
  return rows.map(withPublicDocStatus);
}

export async function listDocumentsForTransaction(transactionType: "invoice" | "bill", transactionId: string) {
  const rows = await prisma.document.findMany({
    where: transactionType === "invoice" ? { invoiceId: transactionId } : { billId: transactionId },
  });
  return rows.map(withPublicDocStatus);
}

export async function getDocument(id: string) {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new AppError(404, "Document not found.");
  const history = await prisma.documentVersion.findMany({ where: { documentId: id }, orderBy: { version: "desc" } });
  return { ...withPublicDocStatus(doc), history };
}

/**
 * Uploading a corrected file bumps the version and puts the document BACK
 * into "Pending Verification."
 */
export async function replaceDocument(id: string, uploadedByEmployeeId: string, fileName: string) {
  const existing = await prisma.document.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Document not found.");

  const nextVersion = existing.version + 1;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.document.update({
      where: { id },
      data: {
        fileName,
        version: nextVersion,
        status: "PendingVerification",
        reviewerVerifierId: null,
        reviewerComments: null,
        rejectionReason: null,
      },
    });

    await tx.documentVersion.create({ data: { documentId: id, version: nextVersion, fileName, uploadedByEmployeeId } });

    return withPublicDocStatus(updated);
  });
}

const DECISION_STATUS = {
  approve: "Verified",
  reject: "Rejected",
  request_changes: "RequiresChanges",
} as const;

/** This is the Verifier's decision, gated by requireVerifierAuth (a completely separate identity realm from employees). */
export async function reviewDocument(id: string, reviewerVerifierId: string, input: ReviewDocumentInput) {
  const existing = await prisma.document.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Document not found.");

  const updated = await prisma.document.update({
    where: { id },
    data: {
      status: DECISION_STATUS[input.decision],
      reviewerVerifierId,
      reviewerComments: input.comments,
      rejectionReason: input.decision === "reject" ? input.rejectionReason : null,
    },
  });
  return withPublicDocStatus(updated);
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
    .update({ where: { id }, data: { docType: input.docType, description: input.description } })
    .catch(() => null);
  if (!updated) throw new AppError(404, "Document not found.");
  return withPublicDocStatus(updated);
}

export async function deleteDocument(id: string) {
  const deleted = await prisma.document.delete({ where: { id } }).catch(() => null);
  if (!deleted) throw new AppError(404, "Document not found.");
  return { id: deleted.id };
}

/**
 * The Verifier queue — every document across EVERY company, joined with
 * the parent invoice/bill's number and the company's name so the queue is
 * actually readable, not just a bare list of file names and UUIDs.
 */
export async function listVerifierQueue(status?: string) {
  const rows = await prisma.document.findMany({
    where: status ? { status: documentStatusToPrisma[status] as never } : undefined,
    include: { company: true, invoice: { select: { invoiceNumber: true } }, bill: { select: { billNumber: true } } },
  });

  return rows.map((r) => {
    const { company, invoice, bill, ...doc } = r;
    return {
      ...withPublicDocStatus(doc),
      companyName: company.name,
      transactionNumber: invoice?.invoiceNumber ?? bill?.billNumber,
      transactionType: invoice ? "invoice" : "bill",
    };
  });
}
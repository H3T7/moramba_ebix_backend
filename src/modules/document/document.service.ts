import { prisma } from "../../db/client.js";
import { AppError } from "../../middleware/errorHandler.js";
import { documentStatusToPrisma } from "../../lib/prismaEnumMaps.js";
import type { UploadDocumentInput, ReviewDocumentInput } from "./document.schema.js";

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
        country: input.country,
        fileName: input.fileName,
        uploadedByEmployeeId,
        version: 1,
      },
    });

    await tx.documentVersion.create({
      data: { documentId: doc.id, version: 1, fileName: input.fileName, uploadedByEmployeeId },
    });

    return doc;
  });
}

export async function listDocumentsByCompany(companyId: string) {
  return prisma.document.findMany({ where: { companyId } });
}

export async function listDocumentsForTransaction(transactionType: "invoice" | "bill", transactionId: string) {
  return prisma.document.findMany({
    where: transactionType === "invoice" ? { invoiceId: transactionId } : { billId: transactionId },
  });
}

export async function getDocument(id: string) {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new AppError(404, "Document not found.");
  const history = await prisma.documentVersion.findMany({ where: { documentId: id }, orderBy: { version: "desc" } });
  return { ...doc, history };
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

    return updated;
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

  return prisma.document.update({
    where: { id },
    data: {
      status: DECISION_STATUS[input.decision],
      reviewerVerifierId,
      reviewerComments: input.comments,
      rejectionReason: input.decision === "reject" ? input.rejectionReason : null,
    },
  });
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
      ...doc,
      companyName: company.name,
      transactionNumber: invoice?.invoiceNumber ?? bill?.billNumber,
      transactionType: invoice ? "invoice" : "bill",
    };
  });
}

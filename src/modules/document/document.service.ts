import { eq, and, desc } from "drizzle-orm";
import { db } from "../../db/client.js";
import { documents, documentVersions, invoices, bills, companies } from "../../db/schema/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import type { UploadDocumentInput, ReviewDocumentInput } from "./document.schema.js";

async function assertParentBelongsToCompany(companyId: string, invoiceId?: string, billId?: string) {
  if (invoiceId) {
    const invoice = await db.query.invoices.findFirst({ where: and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)) });
    if (!invoice) throw new AppError(404, "That invoice doesn't exist for this company.");
  }
  if (billId) {
    const bill = await db.query.bills.findFirst({ where: and(eq(bills.id, billId), eq(bills.companyId, companyId)) });
    if (!bill) throw new AppError(404, "That bill doesn't exist for this company.");
  }
}

/**
 * Uploading and its first version-history row are inserted inside ONE
 * transaction — same reasoning as invoices/bills and their line items: a
 * document that exists with no version-1 history row would be a corrupt,
 * unexplainable record.
 */
export async function uploadDocument(companyId: string, uploadedByEmployeeId: string, input: UploadDocumentInput) {
  await assertParentBelongsToCompany(companyId, input.invoiceId, input.billId);

  return db.transaction(async (tx) => {
    const [doc] = await tx
      .insert(documents)
      .values({
        companyId,
        invoiceId: input.invoiceId,
        billId: input.billId,
        category: input.category,
        country: input.country,
        fileName: input.fileName,
        uploadedByEmployeeId,
        version: 1,
      })
      .returning();

    await tx.insert(documentVersions).values({ documentId: doc.id, version: 1, fileName: input.fileName, uploadedByEmployeeId });

    return doc;
  });
}

export async function listDocumentsByCompany(companyId: string) {
  return db.select().from(documents).where(eq(documents.companyId, companyId));
}

export async function listDocumentsForTransaction(transactionType: "invoice" | "bill", transactionId: string) {
  const column = transactionType === "invoice" ? documents.invoiceId : documents.billId;
  return db.select().from(documents).where(eq(column, transactionId));
}

export async function getDocument(id: string) {
  const doc = await db.query.documents.findFirst({ where: eq(documents.id, id) });
  if (!doc) throw new AppError(404, "Document not found.");
  const history = await db.select().from(documentVersions).where(eq(documentVersions.documentId, id)).orderBy(desc(documentVersions.version));
  return { ...doc, history };
}

/**
 * Uploading a corrected file bumps the version and puts the document BACK
 * into "Pending Verification" — a previously-rejected file being replaced
 * has to be looked at again from scratch, not stay marked Rejected forever
 * while a different file now sits behind that status.
 */
export async function replaceDocument(id: string, uploadedByEmployeeId: string, fileName: string) {
  const existing = await db.query.documents.findFirst({ where: eq(documents.id, id) });
  if (!existing) throw new AppError(404, "Document not found.");

  const nextVersion = existing.version + 1;

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(documents)
      .set({
        fileName,
        version: nextVersion,
        status: "Pending Verification",
        reviewerVerifierId: null,
        reviewerComments: null,
        rejectionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id))
      .returning();

    await tx.insert(documentVersions).values({ documentId: id, version: nextVersion, fileName, uploadedByEmployeeId });

    return updated;
  });
}

const DECISION_STATUS = {
  approve: "Verified",
  reject: "Rejected",
  request_changes: "Requires Changes",
} as const;

/**
 * This is the Verifier's decision, gated by requireVerifierAuth — a
 * completely separate identity realm from employees (see verifiers.ts and
 * requireVerifierAuth in middleware/auth.ts). A verifier can review
 * documents belonging to ANY company; they're not scoped to one.
 */
export async function reviewDocument(id: string, reviewerVerifierId: string, input: ReviewDocumentInput) {
  const existing = await db.query.documents.findFirst({ where: eq(documents.id, id) });
  if (!existing) throw new AppError(404, "Document not found.");

  const [updated] = await db
    .update(documents)
    .set({
      status: DECISION_STATUS[input.decision],
      reviewerVerifierId,
      reviewerComments: input.comments,
      rejectionReason: input.decision === "reject" ? input.rejectionReason : null,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, id))
    .returning();

  return updated;
}

export async function deleteDocument(id: string) {
  const existing = await db.query.documents.findFirst({ where: eq(documents.id, id) });
  if (!existing) throw new AppError(404, "Document not found.");
  await db.delete(documents).where(eq(documents.id, id));
  return { id };
}

/**
 * The Verifier queue — every document across EVERY company, not scoped to
 * one, since a verifier isn't a member of any company (see verifiers.ts).
 * Joined with the parent invoice/bill's number and the company's name so
 * the queue is actually readable ("Certificate of Origin · EXP-2026-0041 ·
 * Aurelia Textiles"), not just a bare list of file names and UUIDs.
 */
export async function listVerifierQueue(status?: string) {
  const rows = await db
    .select({
      document: documents,
      companyName: companies.name,
      invoiceNumber: invoices.invoiceNumber,
      billNumber: bills.billNumber,
    })
    .from(documents)
    .innerJoin(companies, eq(documents.companyId, companies.id))
    .leftJoin(invoices, eq(documents.invoiceId, invoices.id))
    .leftJoin(bills, eq(documents.billId, bills.id))
    .where(status ? eq(documents.status, status as typeof documents.$inferSelect.status) : undefined);

  return rows.map((r) => ({
    ...r.document,
    companyName: r.companyName,
    transactionNumber: r.invoiceNumber ?? r.billNumber,
    transactionType: r.invoiceNumber ? "invoice" : "bill",
  }));
}

import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/client.js";
import { AppError } from "../../middleware/errorHandler.js";
import { documentStatusToPrisma, documentStatusFromPrisma } from "../../lib/prismaEnumMaps.js";
import { validateUpload, saveFile, deleteStoredFile, deleteStoredFiles, locateStoredFile } from "../../lib/fileStorage.js";
import type { UploadDocumentInput, ReviewDocumentInput, UpdateDocumentMetaInput } from "./document.schema.js";

/**
 * What every document query pulls in alongside the row itself: WHO uploaded
 * it (as a name, so the UI can say "by Priya Shah" instead of showing a
 * bare id) and when the CURRENT version was uploaded (the row's own
 * createdAt never changes when a file is replaced).
 */
const documentInclude = {
  uploadedBy: { select: { user: { select: { firstName: true, lastName: true } } } },
  versions: { orderBy: { version: "desc" }, take: 1, select: { uploadedAt: true } },
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
  const { storedName, uploadedBy, versions, status, ...rest } = doc;
  return {
    ...rest,
    status: documentStatusFromPrisma(status),
    uploadedBy: personName(uploadedBy),
    uploadedAt: (versions[0]?.uploadedAt ?? doc.createdAt).toISOString(),
    hasFile: Boolean(storedName),
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

  return { ...toPublicDoc(doc), history };
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
export async function getDocumentFile(id: string, version?: number) {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new AppError(404, "Document not found.");

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
    include: documentInclude,
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
export async function listVerifierQueue(status?: string) {
  const rows = await prisma.document.findMany({
    where: status ? { status: documentStatusToPrisma[status] as never } : undefined,
    include: { ...documentInclude, company: true, invoice: { select: { invoiceNumber: true } }, bill: { select: { billNumber: true } } },
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
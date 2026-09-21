import { prisma } from "../../db/client.js";
import { AppError } from "../../middleware/errorHandler.js";
import { transactionStatusToPrisma, paymentTermsToPrisma, transactionStatusFromPrisma, paymentTermsFromPrisma } from "../../lib/prismaEnumMaps.js";
import type { CreateBillInput, UpdateBillInput } from "./bill.schema.js";
import { listStoredFilesForParent, deleteStoredFiles } from "../document/document.service.js";

async function generateBillNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.bill.count({ where: { billNumber: { startsWith: `IMP-${year}-` } } });
  const next = count + 1;
  return `IMP-${year}-${String(next).padStart(4, "0")}`;
}

function withTotals<T extends { items: { quantity: unknown; rate: unknown; taxPercent: unknown }[] }>(row: T) {
  const items = row.items.map((it) => {
    const lineTotal = Number(it.quantity) * Number(it.rate);
    const tax = lineTotal * (Number(it.taxPercent) / 100);
    return { ...it, lineTotal: lineTotal.toFixed(2), lineTax: tax.toFixed(2) };
  });
  const subtotal = items.reduce((sum, it) => sum + Number(it.lineTotal), 0);
  const taxTotal = items.reduce((sum, it) => sum + Number(it.lineTax), 0);
  return { ...row, items, subtotal: subtotal.toFixed(2), taxTotal: taxTotal.toFixed(2), grandTotal: (subtotal + taxTotal).toFixed(2) };
}

// Prisma always hands back `status`/`paymentTerms` as its own unspaced enum
// identifier ("PayAdvance"), never the spaced string the frontend's
// <select> options and zod schemas actually use ("Pay Advance") — see the
// correction note in prismaEnumMaps.ts. Every read path below runs both
// fields through this before returning, or the edit form's Payment Terms
// field (and any status badge) silently fails to match and renders blank.
function withPublicEnums<T extends { status: string; paymentTerms: string }>(row: T) {
  return { ...row, status: transactionStatusFromPrisma(row.status), paymentTerms: paymentTermsFromPrisma(row.paymentTerms) };
}

async function getBillWithItems(id: string) {
  const bill = await prisma.bill.findUnique({ where: { id }, include: { items: { orderBy: { sortOrder: "asc" } } } });
  if (!bill) return null;
  return withPublicEnums(withTotals(bill));
}

export async function listBillsByCompany(companyId: string) {
  const rows = await prisma.bill.findMany({ where: { companyId }, include: { items: true } });
  return rows.map((bill) => {
    const { items: _items, ...totals } = withTotals(bill);
    return withPublicEnums(totals);
  });
}

export async function getBill(id: string) {
  const bill = await getBillWithItems(id);
  if (!bill) throw new AppError(404, "Bill not found.");
  return bill;
}

export async function createBill(companyId: string, input: CreateBillInput) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError(404, "That company doesn't exist.");

  const vendor = await prisma.vendor.findFirst({ where: { id: input.vendorId, companyId } });
  if (!vendor) throw new AppError(404, "That vendor doesn't exist for this company.");

  const billNumber = await generateBillNumber();

  const created = await prisma.bill.create({
    data: {
      companyId,
      vendorId: input.vendorId,
      billNumber,
      currency: input.currency,
      paymentTerms: paymentTermsToPrisma[input.paymentTerms] as never,
      advancePercent: input.advancePercent,
      importDetails: input.importDetails,
      requiredDocs: input.requiredDocs,
      items: {
        create: input.items.map((item, idx) => ({
          productId: item.productId,
          description: item.description,
          itemCode: item.itemCode,
          sku: item.sku,
          hsCode: item.hsCode,
          unit: item.unit,
          quantity: item.quantity.toFixed(2),
          rate: item.rate.toFixed(2),
          taxPercent: item.taxPercent.toFixed(2),
          sortOrder: idx,
        })),
      },
    },
  });

  return getBillWithItems(created.id);
}

export async function updateBill(id: string, input: UpdateBillInput) {
  const existing = await prisma.bill.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Bill not found.");
  if (existing.submitted) throw new AppError(409, "A submitted bill can't be edited.");

  const { items, ...fields } = input;
  const mappedFields = { ...fields, ...(fields.paymentTerms ? { paymentTerms: paymentTermsToPrisma[fields.paymentTerms] as never } : {}) };

  await prisma.$transaction(async (tx) => {
    if (Object.keys(mappedFields).length > 0) {
      await tx.bill.update({ where: { id }, data: mappedFields });
    }
    if (items) {
      await tx.billItem.deleteMany({ where: { billId: id } });
      await tx.billItem.createMany({
        data: items.map((item, idx) => ({
          billId: id,
          productId: item.productId,
          description: item.description,
          itemCode: item.itemCode,
          sku: item.sku,
          hsCode: item.hsCode,
          unit: item.unit,
          quantity: item.quantity.toFixed(2),
          rate: item.rate.toFixed(2),
          taxPercent: item.taxPercent.toFixed(2),
          sortOrder: idx,
        })),
      });
    }
  });

  return getBillWithItems(id);
}

export async function updateBillStatus(id: string, status: string) {
  const updated = await prisma.bill.update({ where: { id }, data: { status: transactionStatusToPrisma[status] as never } }).catch(() => null);
  if (!updated) throw new AppError(404, "Bill not found.");
  return getBillWithItems(id);
}

export async function submitBill(id: string) {
  const existing = await prisma.bill.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Bill not found.");
  if (existing.submitted) throw new AppError(409, "This bill was already submitted.");

  const updated = await prisma.bill.update({
    where: { id },
    data: { submitted: true, submittedAt: new Date(), status: "Submitted" },
  });
  return getBillWithItems(updated.id);
}

export async function deleteBill(id: string) {
  const existing = await prisma.bill.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Bill not found.");
  if (existing.submitted) throw new AppError(409, "A submitted bill can't be deleted.");

  // Documents cascade-delete in the database, but their FILES on disk don't —
  // collect them first, then clean them up once the bill is really gone.
  const files = await listStoredFilesForParent({ billId: id });
  await prisma.bill.delete({ where: { id } });
  await deleteStoredFiles(files);
  return { id };
}
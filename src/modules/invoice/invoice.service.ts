import { prisma } from "../../db/client.js";
import { AppError } from "../../middleware/errorHandler.js";
import { transactionStatusToPrisma, paymentTermsToPrisma, transactionStatusFromPrisma, paymentTermsFromPrisma } from "../../lib/prismaEnumMaps.js";
import type { CreateInvoiceInput, UpdateInvoiceInput } from "./invoice.schema.js";
import { listStoredFilesForParent, deleteStoredFiles } from "../document/document.service.js";

/**
 * Generates "EXP-2026-0001" style numbers, retrying isn't needed the same
 * way it might seem with Drizzle's raw SQL count — Prisma's `count()` is
 * still a plain COUNT(*) under a race, so the same caveat about two people
 * creating an invoice in the same millisecond theoretically applies. In
 * practice, the `@unique` constraint on invoiceNumber means a genuine
 * collision would surface as a clear Prisma error rather than silently
 * corrupting data — acceptable for this app's actual traffic.
 */
async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.invoice.count({ where: { invoiceNumber: { startsWith: `EXP-${year}-` } } });
  const next = count + 1;
  return `EXP-${year}-${String(next).padStart(4, "0")}`;
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

// See bill.service.ts's matching withPublicEnums for why this is needed —
// Prisma always returns status/paymentTerms as its unspaced enum
// identifier, never the spaced string the frontend actually expects.
function withPublicEnums<T extends { status: string; paymentTerms: string }>(row: T) {
  return { ...row, status: transactionStatusFromPrisma(row.status), paymentTerms: paymentTermsFromPrisma(row.paymentTerms) };
}

async function getInvoiceWithItems(id: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { items: { orderBy: { sortOrder: "asc" } } } });
  if (!invoice) return null;
  return withPublicEnums(withTotals(invoice));
}

export async function listInvoicesByCompany(companyId: string) {
  const rows = await prisma.invoice.findMany({ where: { companyId }, include: { items: true } });
  // List view doesn't need every line item — just totals.
  return rows.map((invoice) => {
    const { items: _items, ...totals } = withTotals(invoice);
    return withPublicEnums(totals);
  });
}

export async function getInvoice(id: string) {
  const invoice = await getInvoiceWithItems(id);
  if (!invoice) throw new AppError(404, "Invoice not found.");
  return invoice;
}

/**
 * The invoice row and every one of its line items are inserted inside ONE
 * database transaction — either all of it commits, or none of it does.
 */
export async function createInvoice(companyId: string, input: CreateInvoiceInput) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new AppError(404, "That company doesn't exist.");

  const customer = await prisma.customer.findFirst({ where: { id: input.customerId, companyId } });
  if (!customer) throw new AppError(404, "That customer doesn't exist for this company.");

  const invoiceNumber = await generateInvoiceNumber();

  const created = await prisma.invoice.create({
    data: {
      companyId,
      customerId: input.customerId,
      invoiceNumber,
      currency: input.currency,
      paymentTerms: paymentTermsToPrisma[input.paymentTerms] as never,
      advancePercent: input.advancePercent,
      exportDetails: input.exportDetails,
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

  return getInvoiceWithItems(created.id);
}

/**
 * If `items` is included in the patch, the ENTIRE line-item set is
 * replaced (delete-all-then-reinsert inside the same transaction) rather
 * than trying to diff and patch individual rows.
 */
export async function updateInvoice(id: string, input: UpdateInvoiceInput) {
  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Invoice not found.");
  if (existing.submitted) throw new AppError(409, "A submitted invoice can't be edited.");

  const { items, ...fields } = input;
  const mappedFields = { ...fields, ...(fields.paymentTerms ? { paymentTerms: paymentTermsToPrisma[fields.paymentTerms] as never } : {}) };

  await prisma.$transaction(async (tx) => {
    if (Object.keys(mappedFields).length > 0) {
      await tx.invoice.update({ where: { id }, data: mappedFields });
    }
    if (items) {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.invoiceItem.createMany({
        data: items.map((item, idx) => ({
          invoiceId: id,
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

  return getInvoiceWithItems(id);
}

export async function updateInvoiceStatus(id: string, status: string) {
  const updated = await prisma.invoice
    .update({ where: { id }, data: { status: transactionStatusToPrisma[status] as never } })
    .catch(() => null);
  if (!updated) throw new AppError(404, "Invoice not found.");
  return getInvoiceWithItems(id);
}

/** Locks the invoice — same one-way gate the frontend already models. */
export async function submitInvoice(id: string) {
  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Invoice not found.");
  if (existing.submitted) throw new AppError(409, "This invoice was already submitted.");

  const updated = await prisma.invoice.update({
    where: { id },
    data: { submitted: true, submittedAt: new Date(), status: "Submitted" },
  });
  return getInvoiceWithItems(updated.id);
}

export async function deleteInvoice(id: string) {
  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Invoice not found.");
  if (existing.submitted) throw new AppError(409, "A submitted invoice can't be deleted.");

  // Documents cascade-delete in the database, but their FILES on disk don't —
  // collect them first, then clean them up once the invoice is really gone.
  const files = await listStoredFilesForParent({ invoiceId: id });
  await prisma.invoice.delete({ where: { id } }); // invoice_items + documents cascade on delete
  await deleteStoredFiles(files);
  return { id };
}
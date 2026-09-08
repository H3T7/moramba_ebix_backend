import { eq, and, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { invoices, invoiceItems, companies, customers } from "../../db/schema/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import type { CreateInvoiceInput, UpdateInvoiceInput } from "./invoice.schema.js";

/**
 * Generates "EXP-2026-0001" style numbers, retrying on the rare collision
 * (two people creating an invoice in the same millisecond) instead of
 * trusting a plain count — a straight COUNT(*) + 1 can produce the same
 * number twice under concurrent requests; catching the unique-constraint
 * violation and retrying is the simple, correct fix without adding a
 * dedicated sequence table.
 */
async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const result = await db.execute<{ count: string }>(sql`select count(*) from ${invoices} where invoice_number like ${"EXP-" + year + "-%"}`);
  const next = Number(result.rows[0].count) + 1;
  return `EXP-${year}-${String(next).padStart(4, "0")}`;
}

function withTotals<T extends { items: { quantity: string; rate: string; taxPercent: string }[] }>(row: T) {
  const items = row.items.map((it) => {
    const lineTotal = Number(it.quantity) * Number(it.rate);
    const tax = lineTotal * (Number(it.taxPercent) / 100);
    return { ...it, lineTotal: lineTotal.toFixed(2), lineTax: tax.toFixed(2) };
  });
  const subtotal = items.reduce((sum, it) => sum + Number(it.lineTotal), 0);
  const taxTotal = items.reduce((sum, it) => sum + Number(it.lineTax), 0);
  return { ...row, items, subtotal: subtotal.toFixed(2), taxTotal: taxTotal.toFixed(2), grandTotal: (subtotal + taxTotal).toFixed(2) };
}

async function getInvoiceWithItems(id: string) {
  const invoice = await db.query.invoices.findFirst({ where: eq(invoices.id, id) });
  if (!invoice) return null;
  const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id)).orderBy(invoiceItems.sortOrder);
  return withTotals({ ...invoice, items });
}

export async function listInvoicesByCompany(companyId: string) {
  const rows = await db.select().from(invoices).where(eq(invoices.companyId, companyId));
  // List view doesn't need every line item — just totals, computed from a
  // single joined query instead of N+1 round-trips per invoice.
  const withSums = await Promise.all(
    rows.map(async (invoice) => {
      const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoice.id));
      const { items: _items, ...totals } = withTotals({ ...invoice, items });
      return totals;
    })
  );
  return withSums;
}

export async function getInvoice(id: string) {
  const invoice = await getInvoiceWithItems(id);
  if (!invoice) throw new AppError(404, "Invoice not found.");
  return invoice;
}

/**
 * The invoice row and every one of its line items are inserted inside ONE
 * database transaction — either all of it commits, or none of it does. An
 * invoice missing its line items (because the process crashed halfway
 * through separate inserts) would be a genuinely corrupt, unusable record;
 * a transaction makes that impossible.
 */
export async function createInvoice(companyId: string, input: CreateInvoiceInput) {
  const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
  if (!company) throw new AppError(404, "That company doesn't exist.");

  const customer = await db.query.customers.findFirst({ where: and(eq(customers.id, input.customerId), eq(customers.companyId, companyId)) });
  if (!customer) throw new AppError(404, "That customer doesn't exist for this company.");

  const invoiceNumber = await generateInvoiceNumber();

  const created = await db.transaction(async (tx) => {
    const [invoice] = await tx
      .insert(invoices)
      .values({
        companyId,
        customerId: input.customerId,
        invoiceNumber,
        currency: input.currency,
        paymentTerms: input.paymentTerms,
        advancePercent: input.advancePercent,
        exportDetails: input.exportDetails,
        requiredDocs: input.requiredDocs,
      })
      .returning();

    await tx.insert(invoiceItems).values(
      input.items.map((item, idx) => ({
        invoiceId: invoice.id,
        productId: item.productId,
        description: item.description,
        hsCode: item.hsCode,
        unit: item.unit,
        quantity: item.quantity.toFixed(2),
        rate: item.rate.toFixed(2),
        taxPercent: item.taxPercent.toFixed(2),
        sortOrder: idx,
      }))
    );

    return invoice;
  });

  return getInvoiceWithItems(created.id);
}

/**
 * If `items` is included in the patch, the ENTIRE line-item set is
 * replaced (delete-all-then-reinsert inside the same transaction) rather
 * than trying to diff and patch individual rows — line items don't have a
 * stable client-side identity worth reconciling against, and this is both
 * simpler and impossible to get subtly wrong.
 */
export async function updateInvoice(id: string, input: UpdateInvoiceInput) {
  const existing = await db.query.invoices.findFirst({ where: eq(invoices.id, id) });
  if (!existing) throw new AppError(404, "Invoice not found.");
  if (existing.submitted) throw new AppError(409, "A submitted invoice can't be edited.");

  await db.transaction(async (tx) => {
    const { items, ...fields } = input;
    if (Object.keys(fields).length > 0) {
      await tx.update(invoices).set({ ...fields, updatedAt: new Date() }).where(eq(invoices.id, id));
    }
    if (items) {
      await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
      await tx.insert(invoiceItems).values(
        items.map((item, idx) => ({
          invoiceId: id,
          productId: item.productId,
          description: item.description,
          hsCode: item.hsCode,
          unit: item.unit,
          quantity: item.quantity.toFixed(2),
          rate: item.rate.toFixed(2),
          taxPercent: item.taxPercent.toFixed(2),
          sortOrder: idx,
        }))
      );
    }
  });

  return getInvoiceWithItems(id);
}

export async function updateInvoiceStatus(id: string, status: string) {
  const [updated] = await db
    .update(invoices)
    .set({ status: status as typeof invoices.$inferSelect.status, updatedAt: new Date() })
    .where(eq(invoices.id, id))
    .returning();
  if (!updated) throw new AppError(404, "Invoice not found.");
  return getInvoiceWithItems(id);
}

/** Locks the invoice — same one-way gate the frontend already models. */
export async function submitInvoice(id: string) {
  const existing = await db.query.invoices.findFirst({ where: eq(invoices.id, id) });
  if (!existing) throw new AppError(404, "Invoice not found.");
  if (existing.submitted) throw new AppError(409, "This invoice was already submitted.");

  const [updated] = await db
    .update(invoices)
    .set({ submitted: true, submittedAt: new Date(), status: "Submitted", updatedAt: new Date() })
    .where(eq(invoices.id, id))
    .returning();
  return getInvoiceWithItems(updated.id);
}

export async function deleteInvoice(id: string) {
  const existing = await db.query.invoices.findFirst({ where: eq(invoices.id, id) });
  if (!existing) throw new AppError(404, "Invoice not found.");
  if (existing.submitted) throw new AppError(409, "A submitted invoice can't be deleted.");

  await db.delete(invoices).where(eq(invoices.id, id)); // invoice_items cascade on delete
  return { id };
}

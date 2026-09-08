import { eq, and } from "drizzle-orm";
import { db } from "../../db/client.js";
import { payments, invoices, invoiceItems, bills, billItems } from "../../db/schema/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import type { CreatePaymentInput } from "./payment.schema.js";

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

export async function createPayment(companyId: string, input: CreatePaymentInput) {
  await assertParentBelongsToCompany(companyId, input.invoiceId, input.billId);

  const [created] = await db
    .insert(payments)
    .values({
      companyId,
      invoiceId: input.invoiceId,
      billId: input.billId,
      amount: input.amount.toFixed(2),
      currency: input.currency,
      paymentType: input.paymentType,
      method: input.method,
      transactionRef: input.transactionRef,
      paymentDate: input.paymentDate,
      status: input.status,
    })
    .returning();

  return created;
}

export async function listPaymentsByCompany(companyId: string) {
  return db.select().from(payments).where(eq(payments.companyId, companyId));
}

export async function listPaymentsForTransaction(transactionType: "invoice" | "bill", transactionId: string) {
  const column = transactionType === "invoice" ? payments.invoiceId : payments.billId;
  return db.select().from(payments).where(eq(column, transactionId));
}

export async function getPayment(id: string) {
  const payment = await db.query.payments.findFirst({ where: eq(payments.id, id) });
  if (!payment) throw new AppError(404, "Payment not found.");
  return payment;
}

export async function updatePaymentStatus(id: string, status: string) {
  const [updated] = await db
    .update(payments)
    .set({ status: status as typeof payments.$inferSelect.status })
    .where(eq(payments.id, id))
    .returning();
  if (!updated) throw new AppError(404, "Payment not found.");
  return updated;
}

export async function deletePayment(id: string) {
  const existing = await db.query.payments.findFirst({ where: eq(payments.id, id) });
  if (!existing) throw new AppError(404, "Payment not found.");
  await db.delete(payments).where(eq(payments.id, id));
  return { id };
}

/**
 * "How much of this invoice/bill is actually paid?" — the grand total is
 * recomputed fresh from the real line items (never trusted as a stored,
 * potentially-stale number), then compared against every COMPLETED
 * payment recorded against it. Pending/failed payments don't count toward
 * "paid" — only money that's actually landed.
 */
export async function getPaymentSummary(transactionType: "invoice" | "bill", transactionId: string) {
  const items =
    transactionType === "invoice"
      ? await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, transactionId))
      : await db.select().from(billItems).where(eq(billItems.billId, transactionId));

  const grandTotal = items.reduce((sum, it) => {
    const lineTotal = Number(it.quantity) * Number(it.rate);
    return sum + lineTotal + lineTotal * (Number(it.taxPercent) / 100);
  }, 0);

  const column = transactionType === "invoice" ? payments.invoiceId : payments.billId;
  const rows = await db
    .select()
    .from(payments)
    .where(and(eq(column, transactionId), eq(payments.status, "completed")));

  const paid = rows.reduce((sum, p) => sum + Number(p.amount), 0);

  return {
    grandTotal: grandTotal.toFixed(2),
    paid: paid.toFixed(2),
    remaining: (grandTotal - paid).toFixed(2),
    paymentCount: rows.length,
  };
}

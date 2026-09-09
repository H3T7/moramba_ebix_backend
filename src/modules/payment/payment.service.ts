import { prisma } from "../../db/client.js";
import { AppError } from "../../middleware/errorHandler.js";
import type { CreatePaymentInput } from "./payment.schema.js";

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

export async function createPayment(companyId: string, input: CreatePaymentInput) {
  await assertParentBelongsToCompany(companyId, input.invoiceId, input.billId);

  return prisma.payment.create({
    data: {
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
    },
  });
}

export async function listPaymentsByCompany(companyId: string) {
  return prisma.payment.findMany({ where: { companyId } });
}

export async function listPaymentsForTransaction(transactionType: "invoice" | "bill", transactionId: string) {
  return prisma.payment.findMany({
    where: transactionType === "invoice" ? { invoiceId: transactionId } : { billId: transactionId },
  });
}

export async function getPayment(id: string) {
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) throw new AppError(404, "Payment not found.");
  return payment;
}

export async function updatePaymentStatus(id: string, status: string) {
  const updated = await prisma.payment.update({ where: { id }, data: { status: status as never } }).catch(() => null);
  if (!updated) throw new AppError(404, "Payment not found.");
  return updated;
}

export async function deletePayment(id: string) {
  const deleted = await prisma.payment.delete({ where: { id } }).catch(() => null);
  if (!deleted) throw new AppError(404, "Payment not found.");
  return { id: deleted.id };
}

/**
 * "How much of this invoice/bill is actually paid?" — the grand total is
 * recomputed fresh from the real line items, never trusted as a stored,
 * potentially-stale number.
 */
export async function getPaymentSummary(transactionType: "invoice" | "bill", transactionId: string) {
  const items =
    transactionType === "invoice"
      ? await prisma.invoiceItem.findMany({ where: { invoiceId: transactionId } })
      : await prisma.billItem.findMany({ where: { billId: transactionId } });

  const grandTotal = items.reduce((sum, it) => {
    const lineTotal = Number(it.quantity) * Number(it.rate);
    return sum + lineTotal + lineTotal * (Number(it.taxPercent) / 100);
  }, 0);

  const rows = await prisma.payment.findMany({
    where: {
      status: "completed",
      ...(transactionType === "invoice" ? { invoiceId: transactionId } : { billId: transactionId }),
    },
  });

  const paid = rows.reduce((sum, p) => sum + Number(p.amount), 0);

  return {
    grandTotal: grandTotal.toFixed(2),
    paid: paid.toFixed(2),
    remaining: (grandTotal - paid).toFixed(2),
    paymentCount: rows.length,
  };
}

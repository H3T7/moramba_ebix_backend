import { eq, and, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { bills, billItems, companies, vendors } from "../../db/schema/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import type { CreateBillInput, UpdateBillInput } from "./bill.schema.js";

async function generateBillNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const result = await db.execute<{ count: string }>(sql`select count(*) from ${bills} where bill_number like ${"IMP-" + year + "-%"}`);
  const next = Number(result.rows[0].count) + 1;
  return `IMP-${year}-${String(next).padStart(4, "0")}`;
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

async function getBillWithItems(id: string) {
  const bill = await db.query.bills.findFirst({ where: eq(bills.id, id) });
  if (!bill) return null;
  const items = await db.select().from(billItems).where(eq(billItems.billId, id)).orderBy(billItems.sortOrder);
  return withTotals({ ...bill, items });
}

export async function listBillsByCompany(companyId: string) {
  const rows = await db.select().from(bills).where(eq(bills.companyId, companyId));
  const withSums = await Promise.all(
    rows.map(async (bill) => {
      const items = await db.select().from(billItems).where(eq(billItems.billId, bill.id));
      const { items: _items, ...totals } = withTotals({ ...bill, items });
      return totals;
    })
  );
  return withSums;
}

export async function getBill(id: string) {
  const bill = await getBillWithItems(id);
  if (!bill) throw new AppError(404, "Bill not found.");
  return bill;
}

export async function createBill(companyId: string, input: CreateBillInput) {
  const company = await db.query.companies.findFirst({ where: eq(companies.id, companyId) });
  if (!company) throw new AppError(404, "That company doesn't exist.");

  const vendor = await db.query.vendors.findFirst({ where: and(eq(vendors.id, input.vendorId), eq(vendors.companyId, companyId)) });
  if (!vendor) throw new AppError(404, "That vendor doesn't exist for this company.");

  const billNumber = await generateBillNumber();

  const created = await db.transaction(async (tx) => {
    const [bill] = await tx
      .insert(bills)
      .values({
        companyId,
        vendorId: input.vendorId,
        billNumber,
        currency: input.currency,
        paymentTerms: input.paymentTerms,
        advancePercent: input.advancePercent,
        importDetails: input.importDetails,
        requiredDocs: input.requiredDocs,
      })
      .returning();

    await tx.insert(billItems).values(
      input.items.map((item, idx) => ({
        billId: bill.id,
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

    return bill;
  });

  return getBillWithItems(created.id);
}

export async function updateBill(id: string, input: UpdateBillInput) {
  const existing = await db.query.bills.findFirst({ where: eq(bills.id, id) });
  if (!existing) throw new AppError(404, "Bill not found.");
  if (existing.submitted) throw new AppError(409, "A submitted bill can't be edited.");

  await db.transaction(async (tx) => {
    const { items, ...fields } = input;
    if (Object.keys(fields).length > 0) {
      await tx.update(bills).set({ ...fields, updatedAt: new Date() }).where(eq(bills.id, id));
    }
    if (items) {
      await tx.delete(billItems).where(eq(billItems.billId, id));
      await tx.insert(billItems).values(
        items.map((item, idx) => ({
          billId: id,
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

  return getBillWithItems(id);
}

export async function updateBillStatus(id: string, status: string) {
  const [updated] = await db
    .update(bills)
    .set({ status: status as typeof bills.$inferSelect.status, updatedAt: new Date() })
    .where(eq(bills.id, id))
    .returning();
  if (!updated) throw new AppError(404, "Bill not found.");
  return getBillWithItems(id);
}

export async function submitBill(id: string) {
  const existing = await db.query.bills.findFirst({ where: eq(bills.id, id) });
  if (!existing) throw new AppError(404, "Bill not found.");
  if (existing.submitted) throw new AppError(409, "This bill was already submitted.");

  const [updated] = await db
    .update(bills)
    .set({ submitted: true, submittedAt: new Date(), status: "Submitted", updatedAt: new Date() })
    .where(eq(bills.id, id))
    .returning();
  return getBillWithItems(updated.id);
}

export async function deleteBill(id: string) {
  const existing = await db.query.bills.findFirst({ where: eq(bills.id, id) });
  if (!existing) throw new AppError(404, "Bill not found.");
  if (existing.submitted) throw new AppError(409, "A submitted bill can't be deleted.");

  await db.delete(bills).where(eq(bills.id, id));
  return { id };
}

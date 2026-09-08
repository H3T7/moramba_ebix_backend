import { eq, and, desc } from "drizzle-orm";
import { db } from "../../db/client.js";
import { shipments, shipmentEvents, invoices, bills } from "../../db/schema/index.js";
import { AppError } from "../../middleware/errorHandler.js";
import type { CreateShipmentInput, UpdateShipmentInput } from "./shipment.schema.js";

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

/** Creating a shipment also writes its first timeline event, in one transaction — same pattern as every other parent+child insert in this API. */
export async function createShipment(companyId: string, input: CreateShipmentInput) {
  await assertParentBelongsToCompany(companyId, input.invoiceId, input.billId);

  return db.transaction(async (tx) => {
    const [shipment] = await tx
      .insert(shipments)
      .values({
        companyId,
        invoiceId: input.invoiceId,
        billId: input.billId,
        carrier: input.carrier,
        trackingNumber: input.trackingNumber,
        origin: input.origin,
        destination: input.destination,
        expectedDate: input.expectedDate,
      })
      .returning();

    await tx.insert(shipmentEvents).values({ shipmentId: shipment.id, status: "Preparing", note: "Shipment created" });

    return shipment;
  });
}

export async function listShipmentsByCompany(companyId: string) {
  return db.select().from(shipments).where(eq(shipments.companyId, companyId));
}

export async function listShipmentsForTransaction(transactionType: "invoice" | "bill", transactionId: string) {
  const column = transactionType === "invoice" ? shipments.invoiceId : shipments.billId;
  return db.select().from(shipments).where(eq(column, transactionId));
}

export async function getShipment(id: string) {
  const shipment = await db.query.shipments.findFirst({ where: eq(shipments.id, id) });
  if (!shipment) throw new AppError(404, "Shipment not found.");
  const timeline = await db.select().from(shipmentEvents).where(eq(shipmentEvents.shipmentId, id)).orderBy(desc(shipmentEvents.occurredAt));
  return { ...shipment, timeline };
}

export async function updateShipment(id: string, input: UpdateShipmentInput) {
  const [updated] = await db.update(shipments).set({ ...input, updatedAt: new Date() }).where(eq(shipments.id, id)).returning();
  if (!updated) throw new AppError(404, "Shipment not found.");
  return updated;
}

/**
 * Every status change is a new timeline event, not an edit to the old
 * one — this is what lets the shipment detail view show a real history
 * ("Preparing → In Transit → Customs → Delivered", each with its own
 * timestamp), not just the current state with no memory of how it got
 * there. "Delivered" also stamps actualDate automatically.
 */
export async function updateShipmentStatus(id: string, status: string, note?: string, location?: string) {
  const existing = await db.query.shipments.findFirst({ where: eq(shipments.id, id) });
  if (!existing) throw new AppError(404, "Shipment not found.");

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(shipments)
      .set({
        status: status as typeof shipments.$inferSelect.status,
        actualDate: status === "Delivered" ? new Date().toISOString().slice(0, 10) : existing.actualDate,
        updatedAt: new Date(),
      })
      .where(eq(shipments.id, id))
      .returning();

    await tx.insert(shipmentEvents).values({ shipmentId: id, status: status as typeof shipments.$inferSelect.status, note, location });

    return updated;
  });
}

export async function deleteShipment(id: string) {
  const existing = await db.query.shipments.findFirst({ where: eq(shipments.id, id) });
  if (!existing) throw new AppError(404, "Shipment not found.");
  await db.delete(shipments).where(eq(shipments.id, id));
  return { id };
}

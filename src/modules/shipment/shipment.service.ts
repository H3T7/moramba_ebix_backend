import { prisma } from "../../db/client.js";
import { AppError } from "../../middleware/errorHandler.js";
import { shipmentStatusToPrisma } from "../../lib/prismaEnumMaps.js";
import type { CreateShipmentInput, UpdateShipmentInput } from "./shipment.schema.js";

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

/** Creating a shipment also writes its first timeline event, in one transaction. */
export async function createShipment(companyId: string, input: CreateShipmentInput) {
  await assertParentBelongsToCompany(companyId, input.invoiceId, input.billId);

  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.create({
      data: {
        companyId,
        invoiceId: input.invoiceId,
        billId: input.billId,
        carrier: input.carrier,
        trackingNumber: input.trackingNumber,
        origin: input.origin,
        destination: input.destination,
        expectedDate: input.expectedDate,
      },
    });

    await tx.shipmentEvent.create({ data: { shipmentId: shipment.id, status: "Preparing", note: "Shipment created" } });

    return shipment;
  });
}

export async function listShipmentsByCompany(companyId: string) {
  return prisma.shipment.findMany({ where: { companyId } });
}

export async function listShipmentsForTransaction(transactionType: "invoice" | "bill", transactionId: string) {
  return prisma.shipment.findMany({
    where: transactionType === "invoice" ? { invoiceId: transactionId } : { billId: transactionId },
  });
}

export async function getShipment(id: string) {
  const shipment = await prisma.shipment.findUnique({ where: { id } });
  if (!shipment) throw new AppError(404, "Shipment not found.");
  const timeline = await prisma.shipmentEvent.findMany({ where: { shipmentId: id }, orderBy: { occurredAt: "desc" } });
  return { ...shipment, timeline };
}

export async function updateShipment(id: string, input: UpdateShipmentInput) {
  const updated = await prisma.shipment.update({ where: { id }, data: input }).catch(() => null);
  if (!updated) throw new AppError(404, "Shipment not found.");
  return updated;
}

/**
 * Every status change is a new timeline event, not an edit to the old
 * one. "Delivered" also stamps actualDate automatically.
 */
export async function updateShipmentStatus(id: string, status: string, note?: string, location?: string) {
  const existing = await prisma.shipment.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "Shipment not found.");

  const prismaStatus = shipmentStatusToPrisma[status] as never;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.shipment.update({
      where: { id },
      data: {
        status: prismaStatus,
        actualDate: status === "Delivered" ? new Date() : existing.actualDate,
      },
    });

    await tx.shipmentEvent.create({ data: { shipmentId: id, status: prismaStatus, note, location } });

    return updated;
  });
}

export async function deleteShipment(id: string) {
  const deleted = await prisma.shipment.delete({ where: { id } }).catch(() => null);
  if (!deleted) throw new AppError(404, "Shipment not found.");
  return { id: deleted.id };
}

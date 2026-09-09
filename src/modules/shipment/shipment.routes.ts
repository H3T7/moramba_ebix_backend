import { Router } from "express";
import { create, list, listForTransaction, getOne, update, updateStatus, remove } from "./shipment.controller.js";
import { requireAuth, requireCompanyParamRole, requireCompanyRole, companyIdFromRecord } from "../../middleware/auth.js";
import { prisma } from "../../db/client.js";

export const shipmentRouter = Router();
export const companyShipmentRouter = Router();
export const transactionShipmentRouter = Router();

const companyIdFromShipment = companyIdFromRecord((id) => prisma.shipment.findUnique({ where: { id } }), "Shipment not found.");

async function companyIdFromTransaction(id: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (invoice) return invoice.companyId;
  const bill = await prisma.bill.findUnique({ where: { id } });
  if (bill) return bill.companyId;
  return null;
}
function requireCompanyRoleForTransaction(...roles: string[]) {
  return requireCompanyRole(async (req) => {
    const companyId = await companyIdFromTransaction(req.params.transactionId as string);
    if (!companyId) throw new Error("Transaction not found.");
    return companyId;
  }, ...roles);
}

companyShipmentRouter.get("/:companyId/shipments", requireAuth, requireCompanyParamRole("admin", "accountant", "hr"), list);
companyShipmentRouter.post("/:companyId/shipments", requireAuth, requireCompanyParamRole("admin", "accountant"), create);

transactionShipmentRouter.get("/:transactionId/shipments", requireAuth, requireCompanyRoleForTransaction("admin", "accountant", "hr"), listForTransaction);

shipmentRouter.get("/:id", requireAuth, requireCompanyRole(companyIdFromShipment, "admin", "accountant", "hr"), getOne);
shipmentRouter.patch("/:id", requireAuth, requireCompanyRole(companyIdFromShipment, "admin", "accountant"), update);
shipmentRouter.patch("/:id/status", requireAuth, requireCompanyRole(companyIdFromShipment, "admin", "accountant"), updateStatus);
shipmentRouter.delete("/:id", requireAuth, requireCompanyRole(companyIdFromShipment, "admin"), remove);

import { Router } from "express";
import { create, list, listForTransaction, getOne, update, updateStatus, remove } from "./shipment.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

/** RBAC widened to include HR alongside Admin/Accountant — matches Products, since logistics coordination isn't purely a finance concern. */
export const shipmentRouter = Router();
export const companyShipmentRouter = Router();
export const transactionShipmentRouter = Router();

companyShipmentRouter.get("/:companyId/shipments", requireAuth, requireRole("admin", "accountant", "hr"), list);
companyShipmentRouter.post("/:companyId/shipments", requireAuth, requireRole("admin", "accountant"), create);

transactionShipmentRouter.get("/:transactionId/shipments", requireAuth, requireRole("admin", "accountant", "hr"), listForTransaction);

shipmentRouter.get("/:id", requireAuth, requireRole("admin", "accountant", "hr"), getOne);
shipmentRouter.patch("/:id", requireAuth, requireRole("admin", "accountant"), update);
shipmentRouter.patch("/:id/status", requireAuth, requireRole("admin", "accountant"), updateStatus);
shipmentRouter.delete("/:id", requireAuth, requireRole("admin"), remove);

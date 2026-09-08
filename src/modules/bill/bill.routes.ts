import { Router } from "express";
import { list, getOne, create, update, updateStatus, submit, remove } from "./bill.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const billRouter = Router();
export const companyBillRouter = Router();

companyBillRouter.get("/:companyId/bills", requireAuth, requireRole("admin", "accountant"), list);
companyBillRouter.post("/:companyId/bills", requireAuth, requireRole("admin", "accountant"), create);

billRouter.get("/:id", requireAuth, requireRole("admin", "accountant"), getOne);
billRouter.patch("/:id", requireAuth, requireRole("admin", "accountant"), update);
billRouter.patch("/:id/status", requireAuth, requireRole("admin"), updateStatus);
billRouter.post("/:id/submit", requireAuth, requireRole("admin"), submit);
billRouter.delete("/:id", requireAuth, requireRole("admin"), remove);

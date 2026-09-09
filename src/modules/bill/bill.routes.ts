import { Router } from "express";
import { list, getOne, create, update, updateStatus, submit, remove } from "./bill.controller.js";
import { requireAuth, requireCompanyParamRole, requireCompanyRole, companyIdFromRecord } from "../../middleware/auth.js";
import { prisma } from "../../db/client.js";

export const billRouter = Router();
export const companyBillRouter = Router();

const companyIdFromBill = companyIdFromRecord((id) => prisma.bill.findUnique({ where: { id } }), "Bill not found.");

companyBillRouter.get("/:companyId/bills", requireAuth, requireCompanyParamRole("admin", "accountant"), list);
companyBillRouter.post("/:companyId/bills", requireAuth, requireCompanyParamRole("admin", "accountant"), create);

billRouter.get("/:id", requireAuth, requireCompanyRole(companyIdFromBill, "admin", "accountant"), getOne);
billRouter.patch("/:id", requireAuth, requireCompanyRole(companyIdFromBill, "admin", "accountant"), update);
billRouter.patch("/:id/status", requireAuth, requireCompanyRole(companyIdFromBill, "admin"), updateStatus);
billRouter.post("/:id/submit", requireAuth, requireCompanyRole(companyIdFromBill, "admin"), submit);
billRouter.delete("/:id", requireAuth, requireCompanyRole(companyIdFromBill, "admin"), remove);

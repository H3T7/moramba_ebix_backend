import { Router } from "express";
import { list, getOne, create, update, remove } from "./vendor.controller.js";
import { requireAuth, requireCompanyParamRole, requireCompanyRole, companyIdFromRecord } from "../../middleware/auth.js";
import { prisma } from "../../db/client.js";

export const vendorRouter = Router();
export const companyVendorRouter = Router();

const companyIdFromVendor = companyIdFromRecord((id) => prisma.vendor.findUnique({ where: { id } }), "Vendor not found.");

companyVendorRouter.get("/:companyId/vendors", requireAuth, requireCompanyParamRole("admin", "accountant"), list);
companyVendorRouter.post("/:companyId/vendors", requireAuth, requireCompanyParamRole("admin", "accountant"), create);

vendorRouter.get("/:id", requireAuth, requireCompanyRole(companyIdFromVendor, "admin", "accountant"), getOne);
vendorRouter.patch("/:id", requireAuth, requireCompanyRole(companyIdFromVendor, "admin", "accountant"), update);
vendorRouter.delete("/:id", requireAuth, requireCompanyRole(companyIdFromVendor, "admin", "accountant"), remove);

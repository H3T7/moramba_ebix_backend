import { Router } from "express";
import { list, getOne, create, update, remove } from "./vendor.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

/** Same nested-resource + RBAC pattern as Customers — Admin + Accountant only. */
export const vendorRouter = Router();
export const companyVendorRouter = Router();

companyVendorRouter.get("/:companyId/vendors", requireAuth, requireRole("admin", "accountant"), list);
companyVendorRouter.post("/:companyId/vendors", requireAuth, requireRole("admin", "accountant"), create);

vendorRouter.get("/:id", requireAuth, requireRole("admin", "accountant"), getOne);
vendorRouter.patch("/:id", requireAuth, requireRole("admin", "accountant"), update);
vendorRouter.delete("/:id", requireAuth, requireRole("admin", "accountant"), remove);

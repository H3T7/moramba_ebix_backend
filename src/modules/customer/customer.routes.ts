import { Router } from "express";
import { list, getOne, create, update, remove } from "./customer.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

/**
 * Mounted at TWO base paths in app.ts, same nested-resource pattern as
 * Employees:
 *   /api/companies/:companyId/customers   → list, create
 *   /api/customers                         → getOne, update, delete (by id)
 *
 * RBAC matches the frontend's rbac.js exactly: Customers is an Admin +
 * Finance/Accountant area — HR and plain Employees have no reason to touch
 * the customer master, so they're blocked here too.
 */
export const customerRouter = Router();
export const companyCustomerRouter = Router();

companyCustomerRouter.get("/:companyId/customers", requireAuth, requireRole("admin", "accountant"), list);
companyCustomerRouter.post("/:companyId/customers", requireAuth, requireRole("admin", "accountant"), create);

customerRouter.get("/:id", requireAuth, requireRole("admin", "accountant"), getOne);
customerRouter.patch("/:id", requireAuth, requireRole("admin", "accountant"), update);
customerRouter.delete("/:id", requireAuth, requireRole("admin", "accountant"), remove);

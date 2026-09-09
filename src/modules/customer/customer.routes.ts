import { Router } from "express";
import { list, getOne, create, update, remove } from "./customer.controller.js";
import { requireAuth, requireCompanyParamRole, requireCompanyRole, companyIdFromRecord } from "../../middleware/auth.js";
import { prisma } from "../../db/client.js";

export const customerRouter = Router();
export const companyCustomerRouter = Router();

const companyIdFromCustomer = companyIdFromRecord((id) => prisma.customer.findUnique({ where: { id } }), "Customer not found.");

companyCustomerRouter.get("/:companyId/customers", requireAuth, requireCompanyParamRole("admin", "accountant"), list);
companyCustomerRouter.post("/:companyId/customers", requireAuth, requireCompanyParamRole("admin", "accountant"), create);

customerRouter.get("/:id", requireAuth, requireCompanyRole(companyIdFromCustomer, "admin", "accountant"), getOne);
customerRouter.patch("/:id", requireAuth, requireCompanyRole(companyIdFromCustomer, "admin", "accountant"), update);
customerRouter.delete("/:id", requireAuth, requireCompanyRole(companyIdFromCustomer, "admin", "accountant"), remove);

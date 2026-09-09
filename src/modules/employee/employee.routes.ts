import { Router } from "express";
import { list, getOne, create, update, updateStatus, updateRole, remove } from "./employee.controller.js";
import { requireAuth, requireCompanyParamRole, requireCompanyRole, companyIdFromRecord } from "../../middleware/auth.js";
import { prisma } from "../../db/client.js";

export const employeeRouter = Router();
export const companyEmployeeRouter = Router();

const companyIdFromEmployee = companyIdFromRecord((id) => prisma.employee.findUnique({ where: { id } }), "Employee not found.");

companyEmployeeRouter.get("/:companyId/employees", requireAuth, requireCompanyParamRole("admin", "hr"), list);
companyEmployeeRouter.post("/:companyId/employees", requireAuth, requireCompanyParamRole("admin", "hr"), create);

employeeRouter.get("/:id", requireAuth, requireCompanyRole(companyIdFromEmployee, "admin", "hr"), getOne);
employeeRouter.patch("/:id", requireAuth, requireCompanyRole(companyIdFromEmployee, "admin", "hr"), update);
employeeRouter.patch("/:id/status", requireAuth, requireCompanyRole(companyIdFromEmployee, "admin", "hr"), updateStatus);
employeeRouter.patch("/:id/role", requireAuth, requireCompanyRole(companyIdFromEmployee, "admin"), updateRole);
employeeRouter.delete("/:id", requireAuth, requireCompanyRole(companyIdFromEmployee, "admin"), remove);

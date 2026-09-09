import { Router } from "express";
import { createStructure, structureHistory, generateRun, listRuns, getRun, patchRunStatus, patchEntryStatus } from "./payroll.controller.js";
import { requireAuth, requireCompanyParamRole, requireCompanyRole, companyIdFromRecord } from "../../middleware/auth.js";
import { prisma } from "../../db/client.js";

export const payrollRouter = Router();
export const companyPayrollRouter = Router();
export const employeePayrollRouter = Router();

const companyIdFromRun = companyIdFromRecord((id) => prisma.payrollRun.findUnique({ where: { id } }), "Payroll run not found.");
const companyIdFromEntry = companyIdFromRecord(async (id) => {
  const entry = await prisma.payrollEntry.findUnique({ where: { id } });
  if (!entry) return null;
  const run = await prisma.payrollRun.findUnique({ where: { id: entry.payrollRunId } });
  return run ?? null;
}, "Payroll entry not found.");

async function companyIdFromEmployeeIdParam(req: { params: { employeeId?: string } }) {
  const record = await prisma.employee.findUnique({ where: { id: req.params.employeeId as string } });
  if (!record) throw new Error("Employee not found.");
  return record.companyId;
}

companyPayrollRouter.post("/:companyId/salary-structures", requireAuth, requireCompanyParamRole("admin", "hr"), createStructure);
companyPayrollRouter.post("/:companyId/payroll-runs", requireAuth, requireCompanyParamRole("admin", "hr"), generateRun);
companyPayrollRouter.get("/:companyId/payroll-runs", requireAuth, requireCompanyParamRole("admin", "hr", "accountant"), listRuns);

employeePayrollRouter.get("/:employeeId/salary-history", requireAuth, requireCompanyRole(companyIdFromEmployeeIdParam, "admin", "hr"), structureHistory);

payrollRouter.get("/runs/:id", requireAuth, requireCompanyRole(companyIdFromRun, "admin", "hr", "accountant"), getRun);
payrollRouter.patch("/runs/:id/status", requireAuth, requireCompanyRole(companyIdFromRun, "admin", "hr"), patchRunStatus);
payrollRouter.patch("/entries/:id/status", requireAuth, requireCompanyRole(companyIdFromEntry, "admin", "hr"), patchEntryStatus);

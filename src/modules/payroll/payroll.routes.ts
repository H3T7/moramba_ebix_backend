import { Router } from "express";
import { createStructure, structureHistory, generateRun, listRuns, getRun, patchRunStatus, patchEntryStatus } from "./payroll.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

/** HR + Admin own payroll, matching the brief's "Access should depend on HR/Finance permissions" — Accountant included too, since payroll is money leaving the company. */
export const payrollRouter = Router();
export const companyPayrollRouter = Router();
export const employeePayrollRouter = Router();

companyPayrollRouter.post("/:companyId/salary-structures", requireAuth, requireRole("admin", "hr"), createStructure);
companyPayrollRouter.post("/:companyId/payroll-runs", requireAuth, requireRole("admin", "hr"), generateRun);
companyPayrollRouter.get("/:companyId/payroll-runs", requireAuth, requireRole("admin", "hr", "accountant"), listRuns);

employeePayrollRouter.get("/:employeeId/salary-history", requireAuth, requireRole("admin", "hr"), structureHistory);

payrollRouter.get("/runs/:id", requireAuth, requireRole("admin", "hr", "accountant"), getRun);
payrollRouter.patch("/runs/:id/status", requireAuth, requireRole("admin", "hr"), patchRunStatus);
payrollRouter.patch("/entries/:id/status", requireAuth, requireRole("admin", "hr"), patchEntryStatus);

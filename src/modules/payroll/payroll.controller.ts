import type { Request, Response } from "express";
import { createSalaryStructureSchema, generateRunSchema, updateEntryStatusSchema, updateRunStatusSchema } from "./payroll.schema.js";
import {
  createSalaryStructure,
  listSalaryHistory,
  generatePayrollRun,
  listPayrollRuns,
  getPayrollRun,
  updateRunStatus,
  updateEntryStatus,
} from "./payroll.service.js";

export async function createStructure(req: Request, res: Response) {
  const input = createSalaryStructureSchema.parse(req.body);
  const structure = await createSalaryStructure(req.params.companyId as string, input);
  res.status(201).json(structure);
}

export async function structureHistory(req: Request, res: Response) {
  const rows = await listSalaryHistory(req.params.employeeId as string);
  res.status(200).json(rows);
}

export async function generateRun(req: Request, res: Response) {
  const input = generateRunSchema.parse(req.body);
  const run = await generatePayrollRun(req.params.companyId as string, req.user!.sub, input);
  res.status(201).json(run);
}

export async function listRuns(req: Request, res: Response) {
  const rows = await listPayrollRuns(req.params.companyId as string);
  res.status(200).json(rows);
}

export async function getRun(req: Request, res: Response) {
  const run = await getPayrollRun(req.params.id as string);
  res.status(200).json(run);
}

export async function patchRunStatus(req: Request, res: Response) {
  const { status } = updateRunStatusSchema.parse(req.body);
  const run = await updateRunStatus(req.params.id as string, status);
  res.status(200).json(run);
}

export async function patchEntryStatus(req: Request, res: Response) {
  const { status } = updateEntryStatusSchema.parse(req.body);
  const entry = await updateEntryStatus(req.params.id as string, status);
  res.status(200).json(entry);
}

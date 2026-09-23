import type { Request, Response } from "express";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  updateEmployeeStatusSchema,
  updateEmployeeRoleSchema,
} from "./employee.schema.js";
import {
  listEmployeesByCompany,
  getEmployee,
  createEmployee,
  updateEmployee,
  updateEmployeeStatus,
  updateEmployeeRole,
  deleteEmployee,
} from "./employee.service.js";

export async function list(req: Request, res: Response) {
  const employees = await listEmployeesByCompany(req.params.companyId as string);
  res.status(200).json(employees);
}

export async function getOne(req: Request, res: Response) {
  const employee = await getEmployee(req.params.id as string);
  res.status(200).json(employee);
}

export async function create(req: Request, res: Response) {
  const input = createEmployeeSchema.parse(req.body);
  // req.employee is the CALLER's own row at this company, resolved by
  // requireCompanyParamRole — needed here because if this email already
  // has an account, createEmployee redirects into creating a real
  // invitation instead (see employee.service.ts), and an invitation needs
  // to record who sent it.
  const result = await createEmployee(req.params.companyId as string, req.employee!.id, input);
  // The service ALWAYS returns `{ type: "invitation", ... }` now (see its
  // own comment — there's no more `{ type: "employee" }` case), so this
  // used to be a single `if` with an unreachable `else` branch, and that
  // unreachable branch was the ONLY one forwarding `temporaryPassword` —
  // meaning it silently never reached the response at all. One branch,
  // forwarding it whenever the service actually set one.
  res.status(200).json({
    type: "invitation",
    invitation: result.invitation,
    ...(result.temporaryPassword ? { temporaryPassword: result.temporaryPassword } : {}),
  });
}

export async function update(req: Request, res: Response) {
  const input = updateEmployeeSchema.parse(req.body);
  const employee = await updateEmployee(req.params.id as string, input);
  res.status(200).json(employee);
}

export async function updateStatus(req: Request, res: Response) {
  const { status } = updateEmployeeStatusSchema.parse(req.body);
  const employee = await updateEmployeeStatus(req.params.id as string, status);
  res.status(200).json(employee);
}

export async function updateRole(req: Request, res: Response) {
  const { role } = updateEmployeeRoleSchema.parse(req.body);
  const employee = await updateEmployeeRole(req.params.id as string, role);
  res.status(200).json(employee);
}

export async function remove(req: Request, res: Response) {
  const result = await deleteEmployee(req.params.id as string);
  res.status(200).json(result);
}

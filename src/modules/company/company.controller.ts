import type { Request, Response } from "express";
import { createCompanySchema } from "./company.schema.js";
import { createCompany, listCompanies, getCompanyById } from "./company.service.js";
import { signEmployeeToken } from "../../lib/jwt.js";
import { AppError } from "../../middleware/errorHandler.js";

/**
 * A JWT is signed ONCE and never auto-updates — it's not a live lookup, it
 * just carries whatever `role` was true the moment someone logged in. If
 * creating this company just made them Owner/Admin for the first time
 * (see company.service.ts), the token they're still holding says
 * "employee." Reported bug: the sidebar stayed stuck on the bare-minimum
 * Employee view until logging out and back in — because nothing ever
 * refreshed the token. Fixed by signing and returning a NEW token here,
 * right alongside the created company, so the frontend can swap it in
 * immediately with no extra round-trip and no re-login required.
 */
export async function create(req: Request, res: Response) {
  const input = createCompanySchema.parse(req.body);
  const { company, employee } = await createCompany(req.user!.sub, input);
  const token = signEmployeeToken({ sub: employee!.id, role: employee!.role, type: "employee" });
  res.status(201).json({ ...company, token });
}

export async function list(_req: Request, res: Response) {
  const all = await listCompanies();
  res.status(200).json(all);
}

export async function getOne(req: Request, res: Response) {
  const id = req.params.id;
  if (typeof id !== "string") {
    throw new AppError(400, "Invalid company id.");
  }
  const company = await getCompanyById(id);
  res.status(200).json(company);
}

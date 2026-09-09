import type { Request, Response } from "express";
import { createCompanySchema } from "./company.schema.js";
import { createCompany, listCompanies, getCompanyById } from "./company.service.js";
import { AppError } from "../../middleware/errorHandler.js";

/**
 * No token-refresh dance needed here anymore, unlike an earlier version of
 * this function. That was only ever a workaround for the JWT carrying a
 * `role` claim that could go stale the moment someone's role changed.
 * Now that role is resolved fresh from the database on every request (see
 * requireCompanyRole in middleware/auth.ts) instead of trusted from the
 * token, there's nothing on the token that COULD go stale — the original
 * token from login/register stays valid and correct for its entire
 * lifetime, no matter how many companies someone creates or joins after
 * getting it.
 */
export async function create(req: Request, res: Response) {
  const input = createCompanySchema.parse(req.body);
  const { company } = await createCompany(req.user!.sub, input);
  res.status(201).json(company);
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

import type { Request, Response } from "express";
import { createCompanySchema } from "./company.schema.js";
import { createCompany, listCompanies, getCompanyById } from "./company.service.js";
import { AppError } from "../../middleware/errorHandler.js";

export async function create(req: Request, res: Response) {
  const input = createCompanySchema.parse(req.body);
  const company = await createCompany(input);
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

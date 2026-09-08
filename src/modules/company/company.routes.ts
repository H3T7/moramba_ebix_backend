import { Router } from "express";
import { create, list, getOne } from "./company.controller.js";
import { requireAuth } from "../../middleware/auth.js";

export const companyRouter = Router();

// Creating a company just requires being signed in — no existing company
// or role, since the whole point is that someone with ZERO companies can
// create their first one and become its Owner (see company.service.ts's
// createCompany, which creates the owner membership in the same
// transaction). Listing is left open for now, same bootstrapping reason
// as before this comment existed.
companyRouter.post("/", requireAuth, create);
companyRouter.get("/", list);
companyRouter.get("/:id", requireAuth, getOne);

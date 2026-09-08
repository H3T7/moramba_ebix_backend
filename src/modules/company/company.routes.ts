import { Router } from "express";
import { create, list, getOne } from "./company.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

export const companyRouter = Router();

// Listing/reading companies is intentionally left open right now so we can
// bootstrap the very first company before any employee account exists.
// Once we build a proper "sign up your business" flow, POST / should
// require auth + requireRole("admin") the same way a delete would.
companyRouter.post("/", create);
companyRouter.get("/", list);
companyRouter.get("/:id", requireAuth, getOne);

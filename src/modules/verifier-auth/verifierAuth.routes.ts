import { Router } from "express";
import { login, me, exchange } from "./verifierAuth.controller.js";
import { requireAuth, requireVerifierAuth } from "../../middleware/auth.js";

export const verifierAuthRouter = Router();

verifierAuthRouter.post("/login", login);
verifierAuthRouter.get("/me", requireVerifierAuth, me);
verifierAuthRouter.post("/exchange", requireAuth, exchange);

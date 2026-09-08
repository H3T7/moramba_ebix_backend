import { Router } from "express";
import { login, me } from "./verifierAuth.controller.js";
import { requireVerifierAuth } from "../../middleware/auth.js";

export const verifierAuthRouter = Router();

verifierAuthRouter.post("/login", login);
verifierAuthRouter.get("/me", requireVerifierAuth, me);

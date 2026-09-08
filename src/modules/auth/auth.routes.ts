import { Router } from "express";
import { register, login, me } from "./auth.controller.js";
import { requireAuth } from "../../middleware/auth.js";

export const authRouter = Router();

// Public — no token needed to hit these.
authRouter.post("/register", register);
authRouter.post("/login", login);

// Protected — requireAuth runs first and blocks the request if there's
// no valid "Authorization: Bearer <token>" header.
authRouter.get("/me", requireAuth, me);

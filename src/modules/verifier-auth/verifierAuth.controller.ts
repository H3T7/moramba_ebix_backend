import type { Request, Response } from "express";
import { verifierLoginSchema } from "./verifierAuth.schema.js";
import { loginVerifier, getVerifierById } from "./verifierAuth.service.js";
import { AppError } from "../../middleware/errorHandler.js";

export async function login(req: Request, res: Response) {
  const input = verifierLoginSchema.parse(req.body);
  const result = await loginVerifier(input);
  res.status(200).json(result);
}

export async function me(req: Request, res: Response) {
  if (!req.verifier) throw new AppError(401, "Not signed in.");
  const verifier = await getVerifierById(req.verifier.sub);
  res.status(200).json({ verifier });
}

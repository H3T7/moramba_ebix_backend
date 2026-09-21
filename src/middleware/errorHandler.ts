import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { env } from "../config/env.js";

/**
 * A small custom Error subclass so route code can do:
 *   throw new AppError(404, "Employee not found");
 * instead of manually calling res.status(...).json(...) everywhere.
 * The `statusCode` travels WITH the error, so one central handler
 * (below) can turn any thrown error into the right HTTP response.
 */
export class AppError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = "AppError";
  }
}

/**
 * Express 5 automatically forwards rejected promises from async route
 * handlers to this error middleware — you don't need a try/catch wrapper
 * around every route. This function is the LAST thing wired up in app.ts,
 * and Express recognizes it as an error handler specifically because it
 * takes 4 arguments (err, req, res, next) instead of 3.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    // A request body/query failed validation — tell the client exactly what's wrong.
    return res.status(400).json({
      error: "Validation failed",
      details: err.flatten().fieldErrors,
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Thrown by the multipart parser (middleware/upload.ts) BEFORE the route
  // handler runs — most commonly a file over the size limit. Without this
  // branch those would fall through to the generic 500 below.
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: `That file is too large. The maximum size is ${env.MAX_UPLOAD_MB} MB.` });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({ error: "Unexpected file field. Send exactly one file in a field named \"file\"." });
    }
    return res.status(400).json({ error: `Upload failed: ${err.message}` });
  }

  /**
   * Prisma's own error type — thrown by the query engine itself, distinct
   * from anything this app's code raises deliberately (that's what
   * AppError above is for). The `.code` values are Prisma's fixed error
   * catalog; these are the ones actually likely to surface in this API:
   *
   *   P2002 — a unique constraint was violated (e.g. two people racing to
   *           register the same email at the exact same moment — the
   *           service layer already checks for this first, but a genuine
   *           race can still slip past that check and hit the DB itself)
   *   P2025 — "record to update/delete not found" — Prisma throws this
   *           instead of just returning zero rows the way Drizzle did,
   *           which is exactly why every service function that does an
   *           update/delete wraps the call in `.catch(() => null)` and
   *           checks for null itself, turning this into a clean 404
   *           instead of it ever reaching here. If one DOES reach here,
   *           it means a spot was missed — worth checking, not just
   *           swallowing as a generic 500.
   *   P2003 — a foreign key constraint failed (e.g. trying to reference a
   *           company id that doesn't exist) — again, service-layer
   *           existence checks should catch this first in almost every
   *           case; this is the fallback if one didn't.
   */
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      const target = (err.meta?.target as string[] | undefined)?.join(", ") ?? "a field";
      return res.status(409).json({ error: `That ${target} is already in use.` });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "The record you're trying to update or delete doesn't exist." });
    }
    if (err.code === "P2003") {
      return res.status(400).json({ error: "That request references something that doesn't exist." });
    }
    console.error("Unhandled Prisma error:", err.code, err.meta);
    return res.status(500).json({ error: "Something went wrong on our end." });
  }

  // Anything else is unexpected — log the real error for us to debug,
  // but never leak internal details (stack traces, SQL errors, etc.) to the client.
  console.error("Unhandled error:", err);
  return res.status(500).json({ error: "Something went wrong on our end." });
}

/** 404 handler — reached only if no route above matched the URL at all. */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `No route: ${req.method} ${req.originalUrl}` });
}
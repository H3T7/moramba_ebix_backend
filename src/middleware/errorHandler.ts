import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

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

  // Anything else is unexpected — log the real error for us to debug,
  // but never leak internal details (stack traces, SQL errors, etc.) to the client.
  console.error("Unhandled error:", err);
  return res.status(500).json({ error: "Something went wrong on our end." });
}

/** 404 handler — reached only if no route above matched the URL at all. */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `No route: ${req.method} ${req.originalUrl}` });
}

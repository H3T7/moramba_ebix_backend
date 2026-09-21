import "dotenv/config";
import { z } from "zod";

/**
 * Why validate env vars at startup?
 * ----------------------------------
 * If someone forgets to set JWT_SECRET, you do NOT want your app to boot
 * successfully and then throw a confusing error three requests later.
 * We check everything ONCE, right when the process starts, and crash
 * immediately with a clear message if anything is missing or malformed.
 * This is called "failing fast."
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  JWT_SECRET: z.string().min(10, "JWT_SECRET must be at least 10 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  // Where uploaded document files are stored on THIS machine's disk. A
  // relative path is resolved against the folder the server is started
  // from (the backend project root when you use `npm run dev`).
  UPLOAD_DIR: z.string().default("uploads"),
  // Largest single file a document upload will accept, in megabytes.
  MAX_UPLOAD_MB: z.coerce.number().positive().default(10),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

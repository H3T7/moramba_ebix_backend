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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

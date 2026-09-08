import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * This file is read by the `drizzle-kit` CLI (the commands in package.json
 * like `db:generate` and `db:migrate`), NOT by the running app itself.
 * It's the migration tool's map: "here's my schema, here's my database."
 */
export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});

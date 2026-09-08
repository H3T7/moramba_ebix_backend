import { app } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/client.js";

async function main() {
  // Fail fast if we can't reach Postgres at all — better to crash loudly
  // right now than to accept requests we can't actually fulfill.
  try {
    await pool.query("SELECT 1");
    console.log("✅ Connected to Postgres");
  } catch (err) {
    console.error("❌ Could not connect to Postgres. Is it running? Is DATABASE_URL correct?");
    console.error(err);
    process.exit(1);
  }

  app.listen(env.PORT, () => {
    console.log(`🚀 Moramba API listening on http://localhost:${env.PORT}`);
    console.log(`   Health check: http://localhost:${env.PORT}/health`);
  });
}

main();

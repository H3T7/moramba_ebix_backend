import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env.js";
import * as schema from "./schema/index.js";

/**
 * A "connection pool" keeps a handful of open connections to Postgres ready
 * to go, instead of opening a brand-new TCP connection for every single
 * query (which is slow). Every part of the app shares this one pool.
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

/**
 * `db` is what the rest of the app actually uses to query the database.
 * Passing `schema` in gives us the fully-typed query API (db.query.employees...)
 * and makes Drizzle aware of the relations we define between tables.
 */
export const db = drizzle(pool, { schema });

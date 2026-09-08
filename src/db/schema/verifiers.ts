import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Deliberately NOT linked to `employees` or `companies` — verifiers are a
 * separate identity system, matching the frontend's "Verification Portal
 * is a separate world" design. A verifier can review documents belonging
 * to ANY company; they don't belong to one.
 */
export const verifiers = pgTable("verifiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  specialization: text("specialization"),
  avatarColor: text("avatar_color").notNull().default("#503589"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

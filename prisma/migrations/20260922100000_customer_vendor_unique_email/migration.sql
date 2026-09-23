-- Case-insensitive uniqueness: the SAME company can't have two customers
-- (or two vendors) with the same email, regardless of letter case. A plain
-- Prisma @@unique on `email` can't express "case-insensitive" or "per
-- company", so this is a functional index over lower(email), scoped to
-- company_id, added directly in SQL.
-- IF NOT EXISTS: safe to re-run.
CREATE UNIQUE INDEX IF NOT EXISTS "customers_company_id_lower_email_key" ON "customers" ("company_id", lower("email"));
CREATE UNIQUE INDEX IF NOT EXISTS "vendors_company_id_lower_email_key" ON "vendors" ("company_id", lower("email"));

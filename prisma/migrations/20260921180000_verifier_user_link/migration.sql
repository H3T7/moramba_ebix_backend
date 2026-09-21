-- AlterTable
-- (Guarded with IF NOT EXISTS so it is safe to re-run.)
ALTER TABLE "verifiers" ADD COLUMN IF NOT EXISTS "user_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "verifiers_user_id_key" ON "verifiers"("user_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'verifiers_user_id_fkey') THEN
    ALTER TABLE "verifiers" ADD CONSTRAINT "verifiers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

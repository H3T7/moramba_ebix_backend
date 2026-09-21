-- CreateTable
-- (IF NOT EXISTS / guarded constraints: safe to run even if the table was already
--  created some other way, e.g. by `prisma db push`.)
CREATE TABLE IF NOT EXISTS "document_reviews" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "verifier_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "document_status" NOT NULL,
    "comments" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "document_reviews_document_id_idx" ON "document_reviews"("document_id");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_reviews_document_id_fkey') THEN
    ALTER TABLE "document_reviews" ADD CONSTRAINT "document_reviews_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_reviews_verifier_id_fkey') THEN
    ALTER TABLE "document_reviews" ADD CONSTRAINT "document_reviews_verifier_id_fkey" FOREIGN KEY ("verifier_id") REFERENCES "verifiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

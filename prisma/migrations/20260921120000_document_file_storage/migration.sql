-- AlterTable
-- (IF NOT EXISTS: safe to run even if these columns were already added to the
--  database some other way, e.g. by `prisma db push` or a half-finished earlier attempt.)
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "file_size" INTEGER,
ADD COLUMN IF NOT EXISTS "mime_type" TEXT,
ADD COLUMN IF NOT EXISTS "stored_name" TEXT;

-- AlterTable
ALTER TABLE "document_versions" ADD COLUMN IF NOT EXISTS "file_size" INTEGER,
ADD COLUMN IF NOT EXISTS "mime_type" TEXT,
ADD COLUMN IF NOT EXISTS "stored_name" TEXT;

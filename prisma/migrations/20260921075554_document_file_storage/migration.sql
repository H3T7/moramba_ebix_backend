-- AlterTable
ALTER TABLE "document_versions" ADD COLUMN     "file_size" INTEGER,
ADD COLUMN     "mime_type" TEXT,
ADD COLUMN     "stored_name" TEXT;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "file_size" INTEGER,
ADD COLUMN     "mime_type" TEXT,
ADD COLUMN     "stored_name" TEXT;

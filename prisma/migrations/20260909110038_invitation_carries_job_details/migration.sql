-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "bank_account_number" TEXT,
ADD COLUMN     "bank_ifsc" TEXT,
ADD COLUMN     "bank_name" TEXT,
ADD COLUMN     "date_of_joining" DATE,
ADD COLUMN     "employeeCode" TEXT,
ADD COLUMN     "employment_type" "employment_type",
ADD COLUMN     "payment_mode" TEXT DEFAULT 'bank';

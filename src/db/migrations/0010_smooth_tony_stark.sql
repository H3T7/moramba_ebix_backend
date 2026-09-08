ALTER TABLE "documents" DROP CONSTRAINT "documents_reviewer_employee_id_employees_id_fk";
--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN "reviewer_employee_id";
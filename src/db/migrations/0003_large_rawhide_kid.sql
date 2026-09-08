CREATE TYPE "public"."membership_role" AS ENUM('owner', 'admin', 'hr', 'accountant', 'operations', 'verifier', 'viewer', 'employee');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'suspended', 'removed');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'rejected', 'expired', 'cancelled');--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"role" "membership_role" NOT NULL,
	"department" text,
	"designation" text,
	"phone" text,
	"invited_employee_id" uuid,
	"invited_by_employee_id" uuid NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employee_companies" DROP CONSTRAINT "employee_companies_employee_id_company_id_pk";--> statement-breakpoint
ALTER TABLE "employees" ALTER COLUMN "company_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ALTER COLUMN "employee_code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ALTER COLUMN "phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ALTER COLUMN "department" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ALTER COLUMN "designation" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ALTER COLUMN "date_of_joining" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_companies" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_companies" ADD COLUMN "role" "membership_role" DEFAULT 'employee' NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_companies" ADD COLUMN "status" "membership_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_companies" ADD COLUMN "joined_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_employee_id_employees_id_fk" FOREIGN KEY ("invited_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_employee_id_employees_id_fk" FOREIGN KEY ("invited_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_companies" ADD CONSTRAINT "employee_company_unique" UNIQUE("employee_id","company_id");
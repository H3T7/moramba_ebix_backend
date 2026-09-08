CREATE TYPE "public"."employee_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('Full-time', 'Part-time', 'Contract');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'hr', 'accountant', 'employee');--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"logo_text" text NOT NULL,
	"logo_color" text NOT NULL,
	"tax_id" text NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"address" jsonb NOT NULL,
	"bank" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_code" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"phone" text NOT NULL,
	"dob" date,
	"gender" text,
	"address" text,
	"department" text NOT NULL,
	"designation" text NOT NULL,
	"role" "role" DEFAULT 'employee' NOT NULL,
	"date_of_joining" date NOT NULL,
	"employment_type" "employment_type" DEFAULT 'Full-time' NOT NULL,
	"status" "employee_status" DEFAULT 'active' NOT NULL,
	"payment_mode" text DEFAULT 'bank' NOT NULL,
	"bank_account_number" text,
	"bank_ifsc" text,
	"bank_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "employees_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "employee_companies" (
	"employee_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	CONSTRAINT "employee_companies_employee_id_company_id_pk" PRIMARY KEY("employee_id","company_id")
);
--> statement-breakpoint
CREATE TABLE "verifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"specialization" text,
	"avatar_color" text DEFAULT '#503589' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "verifiers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_companies" ADD CONSTRAINT "employee_companies_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_companies" ADD CONSTRAINT "employee_companies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
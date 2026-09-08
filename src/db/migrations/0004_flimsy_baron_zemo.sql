CREATE TYPE "public"."invoice_status" AS ENUM('Draft', 'Submitted', 'Processing', 'Documents Pending', 'Ready', 'Completed', 'Cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_terms" AS ENUM('Pay Advance', 'Pay Later', 'Letter of Credit', '50% Advance / 50% on Shipment');--> statement-breakpoint
CREATE TYPE "public"."bill_status" AS ENUM('Draft', 'Submitted', 'Processing', 'Documents Pending', 'Ready', 'Completed', 'Cancelled');--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"product_id" uuid,
	"description" text NOT NULL,
	"hs_code" text,
	"unit" text NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"rate" numeric(12, 2) NOT NULL,
	"tax_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"payment_terms" "payment_terms" DEFAULT 'Pay Later' NOT NULL,
	"advance_percent" integer DEFAULT 0 NOT NULL,
	"export_details" jsonb NOT NULL,
	"required_docs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "invoice_status" DEFAULT 'Draft' NOT NULL,
	"submitted" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "bill_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"product_id" uuid,
	"description" text NOT NULL,
	"hs_code" text,
	"unit" text NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"rate" numeric(12, 2) NOT NULL,
	"tax_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"bill_number" text NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"payment_terms" "payment_terms" DEFAULT 'Pay Later' NOT NULL,
	"advance_percent" integer DEFAULT 0 NOT NULL,
	"import_details" jsonb NOT NULL,
	"required_docs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "bill_status" DEFAULT 'Draft' NOT NULL,
	"submitted" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bills_bill_number_unique" UNIQUE("bill_number")
);
--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_items" ADD CONSTRAINT "bill_items_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;
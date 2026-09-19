CREATE TYPE "public"."complaint_doc_type" AS ENUM('DNI', 'CE', 'RUC', 'PASAPORTE');--> statement-breakpoint
CREATE TYPE "public"."complaint_status" AS ENUM('pending', 'in_review', 'responded');--> statement-breakpoint
CREATE TYPE "public"."complaint_type" AS ENUM('reclamo', 'queja');--> statement-breakpoint
CREATE TABLE "complaints" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"code" varchar(24) NOT NULL,
	"type" "complaint_type" NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"doc_type" "complaint_doc_type" NOT NULL,
	"doc_number" varchar(20) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"address" text NOT NULL,
	"order_number" varchar(50),
	"is_minor" boolean DEFAULT false NOT NULL,
	"guardian_name" varchar(255),
	"guardian_doc_number" varchar(20),
	"description" text NOT NULL,
	"request" text NOT NULL,
	"status" "complaint_status" DEFAULT 'pending' NOT NULL,
	"response_text" text,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "complaints_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE INDEX "complaints_status_idx" ON "complaints" USING btree ("status");--> statement-breakpoint
CREATE INDEX "complaints_doc_number_idx" ON "complaints" USING btree ("doc_number");--> statement-breakpoint
CREATE INDEX "complaints_created_at_idx" ON "complaints" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "complaints_status_created_idx" ON "complaints" USING btree ("status","created_at");
CREATE TYPE "public"."product_managed_by" AS ENUM('provider', 'manual');--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "managed_by" "product_managed_by" DEFAULT 'provider' NOT NULL;--> statement-breakpoint
UPDATE "products" SET "managed_by" = 'manual' WHERE "created_by" IS NOT NULL;
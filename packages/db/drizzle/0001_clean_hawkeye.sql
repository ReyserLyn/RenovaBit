CREATE TABLE "scraping_blacklist" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"source" varchar(100) NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"product_name" varchar(255),
	"reason" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scraping_blacklist_source_external_unique" UNIQUE("source","external_id")
);
--> statement-breakpoint
ALTER TABLE "scraping_blacklist" ADD CONSTRAINT "scraping_blacklist_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scraping_blacklist_source_idx" ON "scraping_blacklist" USING btree ("source");
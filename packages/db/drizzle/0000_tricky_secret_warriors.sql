CREATE TYPE "public"."user_role" AS ENUM('admin', 'customer', 'distributor');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"impersonated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"username" varchar(100),
	"display_username" varchar(100),
	"phone" varchar(20),
	"role" "user_role" DEFAULT 'customer' NOT NULL,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"image_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"seo_title" varchar(255),
	"seo_description" varchar(500),
	"seo_keywords" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "brands_name_unique" UNIQUE("name"),
	CONSTRAINT "brands_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"image_url" text,
	"parent_id" uuid,
	"path" text,
	"sort_order" integer DEFAULT 0,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_visible_in_nav" boolean DEFAULT true NOT NULL,
	"seo_title" varchar(255),
	"seo_description" varchar(500),
	"seo_keywords" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name"),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"product_id" uuid NOT NULL,
	"url" text NOT NULL,
	"alt" varchar(255),
	"sort_order" integer DEFAULT 0,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"sku" varchar(100) NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"brand_id" uuid,
	"category_id" uuid,
	"specifications" jsonb DEFAULT '[]'::jsonb,
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"seo_title" varchar(255),
	"seo_description" varchar(500),
	"seo_keywords" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_name_unique" UNIQUE("name"),
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_userId_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_userId_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "brands_slug_idx" ON "brands" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "brands_active_idx" ON "brands" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "brands_featured_idx" ON "brands" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_parent_id_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "categories_active_idx" ON "categories" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "categories_sort_order_idx" ON "categories" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "categories_name_idx" ON "categories" USING btree ("name");--> statement-breakpoint
CREATE INDEX "product_images_product_id_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_images_sort_order_idx" ON "product_images" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "product_images_primary_idx" ON "product_images" USING btree ("is_primary");--> statement-breakpoint
CREATE INDEX "products_slug_idx" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "products_sku_idx" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "products_brand_id_idx" ON "products" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "products_category_id_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "products_featured_idx" ON "products" USING btree ("is_featured");
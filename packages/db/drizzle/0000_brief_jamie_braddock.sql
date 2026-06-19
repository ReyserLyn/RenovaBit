CREATE TYPE "public"."user_role" AS ENUM('admin', 'customer', 'distributor');--> statement-breakpoint
CREATE TYPE "public"."cart_item_status" AS ENUM('available', 'out_of_stock', 'price_changed', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('percentage', 'fixed_amount');--> statement-breakpoint
CREATE TYPE "public"."offer_type" AS ENUM('product', 'category', 'brand');--> statement-breakpoint
CREATE TYPE "public"."order_source" AS ENUM('web', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'transfer', 'yape', 'plin');--> statement-breakpoint
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
	"lastname" varchar(100),
	"phone" varchar(20),
	"role" "user_role" DEFAULT 'customer' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
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
	"created_by" uuid,
	"updated_by" uuid,
	"seo_title" varchar(255),
	"seo_description" varchar(500),
	"seo_keywords" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "brands_name_unique" UNIQUE("name"),
	CONSTRAINT "brands_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"cart_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"added_at_price" numeric(12, 2) NOT NULL,
	"status" "cart_item_status" DEFAULT 'available' NOT NULL,
	"status_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cart_items_cart_product_unique" UNIQUE("cart_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid,
	"guest_token" varchar(64),
	"items_count" integer DEFAULT 0 NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
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
	"created_by" uuid,
	"updated_by" uuid,
	"seo_title" varchar(255),
	"seo_description" varchar(500),
	"seo_keywords" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name"),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "favorite_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"favorite_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_items_fav_product_unique" UNIQUE("favorite_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"items_count" integer DEFAULT 0 NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "margin_rules" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" varchar(100) NOT NULL,
	"min_price" numeric(10, 2) NOT NULL,
	"max_price" numeric(10, 2),
	"customer_pct" numeric(5, 2) NOT NULL,
	"distributor_pct" numeric(5, 2) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "margin_rules_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "offer_brands" (
	"offer_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"override_discount_type" "discount_type",
	"override_discount_value" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "offer_brands_offer_id_brand_id_pk" PRIMARY KEY("offer_id","brand_id")
);
--> statement-breakpoint
CREATE TABLE "offer_categories" (
	"offer_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"override_discount_type" "discount_type",
	"override_discount_value" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "offer_categories_offer_id_category_id_pk" PRIMARY KEY("offer_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "offer_products" (
	"offer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"override_discount_type" "discount_type",
	"override_discount_value" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "offer_products_offer_id_product_id_pk" PRIMARY KEY("offer_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"type" "offer_type" DEFAULT 'product' NOT NULL,
	"discount_type" "discount_type" NOT NULL,
	"discount_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"is_active" boolean DEFAULT true,
	"is_featured" boolean DEFAULT false,
	"is_customer_only" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "offers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"product_name" varchar(255) NOT NULL,
	"product_sku" varchar(100) NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"final_price" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid,
	"cart_id" uuid,
	"order_number" varchar(50) NOT NULL,
	"customer_name" varchar(255),
	"customer_phone" varchar(20),
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"source" "order_source" DEFAULT 'web' NOT NULL,
	"payment_method" "payment_method",
	"payment_proof_url" text,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"admin_notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"confirmed_at" timestamp,
	"cancelled_at" timestamp,
	"cancel_reason" text,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_cart_id_unique" UNIQUE("cart_id"),
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
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
	"supplier_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"role_custom_margins" jsonb,
	"stock" integer DEFAULT 0 NOT NULL,
	"brand_id" uuid,
	"category_id" uuid,
	"specifications" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"review_reason" varchar(500),
	"created_by" uuid,
	"updated_by" uuid,
	"seo_title" varchar(255),
	"seo_description" varchar(500),
	"seo_keywords" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('spanish', "products"."name")) STORED,
	CONSTRAINT "products_name_unique" UNIQUE("name"),
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "product_providers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"product_id" uuid NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"source" varchar(100) NOT NULL,
	"raw_name" text,
	"raw_price" numeric(12, 2),
	"raw_stock" integer DEFAULT 0 NOT NULL,
	"last_sync_at" timestamp,
	"last_seen_at" timestamp,
	"is_unavailable" boolean DEFAULT false NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"review_reason" text,
	"raw_image_url" text,
	"raw_image_hash" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_providers_external_unique" UNIQUE("source","external_id")
);
--> statement-breakpoint
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
CREATE TABLE "admin_notifications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text,
	"data" jsonb,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_changes" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"product_id" uuid NOT NULL,
	"sync_report_id" uuid,
	"user_id" uuid,
	"source" varchar(50) NOT NULL,
	"change_type" varchar(50) NOT NULL,
	"field" varchar(50),
	"old_value" jsonb,
	"new_value" jsonb,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_reports" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"job_id" varchar(128),
	"trigger" varchar(50) DEFAULT 'manual' NOT NULL,
	"status" varchar(50) DEFAULT 'running' NOT NULL,
	"stats" jsonb DEFAULT '{"processed":0,"created":0,"updated":0,"unchanged":0,"errors":0,"outOfStock":0}'::jsonb NOT NULL,
	"error_message" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_items" ADD CONSTRAINT "favorite_items_favorite_id_favorites_id_fk" FOREIGN KEY ("favorite_id") REFERENCES "public"."favorites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorite_items" ADD CONSTRAINT "favorite_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_brands" ADD CONSTRAINT "offer_brands_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_brands" ADD CONSTRAINT "offer_brands_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_categories" ADD CONSTRAINT "offer_categories_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_categories" ADD CONSTRAINT "offer_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_products" ADD CONSTRAINT "offer_products_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offer_products" ADD CONSTRAINT "offer_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_providers" ADD CONSTRAINT "product_providers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scraping_blacklist" ADD CONSTRAINT "scraping_blacklist_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_notifications" ADD CONSTRAINT "admin_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_changes" ADD CONSTRAINT "product_changes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_changes" ADD CONSTRAINT "product_changes_sync_report_id_sync_reports_id_fk" FOREIGN KEY ("sync_report_id") REFERENCES "public"."sync_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_changes" ADD CONSTRAINT "product_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_userId_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_userId_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "brands_slug_idx" ON "brands" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "brands_active_idx" ON "brands" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "brands_featured_idx" ON "brands" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "cart_items_cart_id_idx" ON "cart_items" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "cart_items_product_id_idx" ON "cart_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "carts_last_activity_idx" ON "carts" USING btree ("last_activity_at");--> statement-breakpoint
CREATE UNIQUE INDEX "carts_user_id_unique" ON "carts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "carts_guest_token_unique" ON "carts" USING btree ("guest_token");--> statement-breakpoint
CREATE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_parent_id_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "categories_active_idx" ON "categories" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "categories_sort_order_idx" ON "categories" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "categories_name_idx" ON "categories" USING btree ("name");--> statement-breakpoint
CREATE INDEX "categories_path_idx" ON "categories" USING btree ("path");--> statement-breakpoint
CREATE INDEX "favorite_items_favorite_id_idx" ON "favorite_items" USING btree ("favorite_id");--> statement-breakpoint
CREATE INDEX "favorite_items_product_id_idx" ON "favorite_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "favorites_last_activity_idx" ON "favorites" USING btree ("last_activity_at");--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_user_id_unique" ON "favorites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "margin_rules_range_idx" ON "margin_rules" USING btree ("min_price","max_price");--> statement-breakpoint
CREATE INDEX "offer_brands_offer_idx" ON "offer_brands" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "offer_brands_brand_idx" ON "offer_brands" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "offer_categories_offer_idx" ON "offer_categories" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "offer_categories_category_idx" ON "offer_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "offer_products_offer_idx" ON "offer_products" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "offer_products_product_idx" ON "offer_products" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "offers_slug_idx" ON "offers" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "offers_active_dates_idx" ON "offers" USING btree ("is_active","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "offers_is_featured_idx" ON "offers" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_id_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "orders_user_id_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_order_number_idx" ON "orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_status_created_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "product_images_product_id_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_slug_idx" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "products_sku_idx" ON "products" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "products_brand_id_idx" ON "products" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "products_category_id_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_is_active_idx" ON "products" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "products_featured_idx" ON "products" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "products_supplier_price_idx" ON "products" USING btree ("supplier_price");--> statement-breakpoint
CREATE INDEX "products_search_vector_idx" ON "products" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "product_providers_product_idx" ON "product_providers" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_providers_source_unavail_idx" ON "product_providers" USING btree ("source","is_unavailable");--> statement-breakpoint
CREATE INDEX "scraping_blacklist_source_idx" ON "scraping_blacklist" USING btree ("source");--> statement-breakpoint
CREATE INDEX "admin_notifications_user_idx" ON "admin_notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "admin_notifications_unread_idx" ON "admin_notifications" USING btree ("user_id","is_read") WHERE "admin_notifications"."is_read" = false;--> statement-breakpoint
CREATE INDEX "product_changes_product_idx" ON "product_changes" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_changes_report_idx" ON "product_changes" USING btree ("sync_report_id");--> statement-breakpoint
CREATE INDEX "product_changes_type_idx" ON "product_changes" USING btree ("change_type");--> statement-breakpoint
CREATE INDEX "sync_reports_status_idx" ON "sync_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sync_reports_started_at_idx" ON "sync_reports" USING btree ("started_at");
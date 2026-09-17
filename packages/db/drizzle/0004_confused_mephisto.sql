CREATE INDEX "products_needs_review_idx" ON "products" USING btree ("needs_review");--> statement-breakpoint
CREATE INDEX "product_changes_created_at_idx" ON "product_changes" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");--> statement-breakpoint
ALTER TABLE "margin_rules" ADD CONSTRAINT "margin_rules_valid_range" CHECK ("margin_rules"."min_price" >= 0 AND ("margin_rules"."max_price" IS NULL OR "margin_rules"."max_price" > "margin_rules"."min_price"));--> statement-breakpoint
ALTER TABLE "margin_rules" ADD CONSTRAINT "margin_rules_customer_pct_range" CHECK ("margin_rules"."customer_pct" >= 0 AND "margin_rules"."customer_pct" <= 100);--> statement-breakpoint
ALTER TABLE "offer_products" ADD CONSTRAINT "offer_products_override_range" CHECK ("offer_products"."override_discount_value" IS NULL OR ("offer_products"."override_discount_value" >= 0 AND "offer_products"."override_discount_value" <= 100));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_stock_non_negative" CHECK ("products"."stock" >= 0);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_price_non_negative" CHECK ("products"."price" >= 0);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_price_non_negative" CHECK ("products"."supplier_price" >= 0);
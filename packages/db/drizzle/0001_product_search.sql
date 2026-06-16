CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
-- name is NOT NULL in products schema, so no coalesce needed
ALTER TABLE "products" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('spanish', "name")) STORED;--> statement-breakpoint
CREATE INDEX "products_search_vector_idx" ON "products" USING GIN ("search_vector");--> statement-breakpoint
CREATE INDEX "products_name_trigram_idx" ON "products" USING GIN ("name" gin_trgm_ops);

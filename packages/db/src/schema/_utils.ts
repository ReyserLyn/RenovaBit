import { sql } from "drizzle-orm";
import { pgEnum, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Primary key using UUID v7 for better performance and sortability
 */
export const primaryKey = {
	id: uuid("id").primaryKey().default(sql`uuidv7()`),
};

/**
 * Lifecycle date fields - createdAt and updatedAt
 * Automatically managed by database and Drizzle
 */
export const lifecycleDates = {
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
};

/**
 * SEO fields for entities that need SEO optimization
 */
export const seoFields = {
	seoTitle: varchar("seo_title", { length: 255 }),
	seoDescription: varchar("seo_description", { length: 500 }),
	seoKeywords: varchar("seo_keywords", { length: 500 }),
};

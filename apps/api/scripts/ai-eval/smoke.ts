import { db } from "@renovabit/db";
import { brands, categories } from "@renovabit/db/schema";
import { eq } from "drizzle-orm";
import { extractFromRawName } from "../../src/modules/product-processing/ai/ai.service";
import { buildCategoryContext } from "../../src/modules/product-processing/ai/prompts";

const raw = process.argv[2] ?? "CASE GAMER MICRONICS GAMING EMPIRE FC101  5FAN ARGB";
const startedAt = Date.now();

// Same context the sync builds: real categories with hierarchy + active brands.
const [brandRows, categoryRows] = await Promise.all([
	db.select({ name: brands.name }).from(brands).where(eq(brands.isActive, true)),
	db
		.select({ id: categories.id, name: categories.name, parentId: categories.parentId })
		.from(categories)
		.where(eq(categories.isActive, true)),
]);

const result = await extractFromRawName(raw, {
	brands: brandRows.map((brand) => brand.name),
	categories: buildCategoryContext(categoryRows),
});

console.log(
	JSON.stringify(
		{
			ms: Date.now() - startedAt,
			raw,
			name: result.name,
			brand: result.brand,
			category: result.category,
			specifications: result.specifications.map((s) => `${s.key}: ${s.value}`),
			needsReview: result.needsReview,
		},
		null,
		2,
	),
);

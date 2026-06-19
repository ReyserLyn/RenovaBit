import { db } from "@renovabit/db";
import { categories } from "@renovabit/db/schema";
import { and, eq, like } from "drizzle-orm";

/**
 * Dado un slug de categoría, devuelve los IDs de la categoría y
 * todos sus descendientes (via path matching).
 * Si la categoría no tiene hijos, devuelve solo su propio ID.
 *
 * Es el SSoT de esta lógica que antes estaba duplicada en:
 * - products/service.ts:getDescendantCategoryIds
 * - brands/service.ts:listPublic
 * - categories/service.ts:getBySlugPublic
 */
export async function getCategoryAndDescendantIds(slug: string): Promise<string[]> {
	const [category] = await db
		.select({ id: categories.id, path: categories.path })
		.from(categories)
		.where(and(eq(categories.slug, slug), eq(categories.isActive, true)))
		.limit(1);

	if (!category) return [];

	// BuildPath: parent.path + parent.id + "/"
	// Hijos de esta categoría tienen path = (category.path ?? "/") + category.id + "/" + ...
	const pathPrefix = `${category.path ?? "/"}${category.id}/`;

	const descendants = await db
		.select({ id: categories.id })
		.from(categories)
		.where(and(like(categories.path, `${pathPrefix}%`), eq(categories.isActive, true)));

	return [category.id, ...descendants.map((d) => d.id)];
}

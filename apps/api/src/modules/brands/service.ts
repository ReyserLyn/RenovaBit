import { db } from "@renovabit/db";
import { brands } from "@renovabit/db/schema";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import slugify from "slugify";
import type { BrandModel } from "./model";

export abstract class BrandService {
	// ── Queries ────────────────────────────────────

	static async list(filters?: { isActive?: boolean; isFeatured?: boolean }) {
		const c = [];
		if (filters?.isActive !== undefined) c.push(eq(brands.isActive, filters.isActive));
		if (filters?.isFeatured !== undefined) c.push(eq(brands.isFeatured, filters.isFeatured));
		return db
			.select()
			.from(brands)
			.where(c.length ? and(...c) : undefined)
			.orderBy(desc(brands.createdAt));
	}

	static async getBySlug(slug: string) {
		const r = await db.select().from(brands).where(eq(brands.slug, slug)).limit(1);
		return r[0] ?? null;
	}

	static async getByIds(ids: string[]) {
		return db.select().from(brands).where(inArray(brands.id, ids));
	}

	// ── Create ─────────────────────────────────────

	static async create(data: BrandModel["createBody"]) {
		const slug = data.slug || slugify(data.name!, { lower: true, strict: true });

		// Check duplicates
		const exists = await db
			.select({ id: brands.id })
			.from(brands)
			.where(or(eq(brands.name, data.name), eq(brands.slug, slug)))
			.limit(1);

		if (exists.length) {
			const conflict = exists[0];
			throw Object.assign(new Error("Ya existe una marca con este nombre o slug"), {
				statusCode: 409,
				conflict,
			});
		}

		const [item] = await db
			.insert(brands)
			.values({ ...data, slug })
			.returning();
		return item;
	}

	// ── Update ─────────────────────────────────────

	static async update(slug: string, data: BrandModel["updateBody"]) {
		const existing = await BrandService.getBySlug(slug);
		if (!existing) return null;

		// If name/slug changed, check duplicates
		if (data.name && data.name !== existing.name) {
			const dup = await db
				.select({ id: brands.id })
				.from(brands)
				.where(eq(brands.name, data.name))
				.limit(1);
			if (dup.length)
				throw Object.assign(new Error("Ya existe una marca con este nombre"), { statusCode: 409 });
		}

		const [item] = await db.update(brands).set(data).where(eq(brands.slug, slug)).returning();
		return item;
	}

	// ── Delete ─────────────────────────────────────

	static async delete(slug: string) {
		const existing = await BrandService.getBySlug(slug);
		if (!existing) return false;
		await db.delete(brands).where(eq(brands.slug, slug));
		return true;
	}

	// ── Bulk Delete ────────────────────────────────

	static async deleteMany(ids: string[]) {
		const existing = await BrandService.getByIds(ids);
		const existingIds = existing.map((b) => b.id);
		const notFoundIds = ids.filter((id) => !existingIds.includes(id));

		if (existingIds.length === 0)
			return { deletedCount: 0, deletedIds: [] as string[], notFoundIds };

		await db.delete(brands).where(inArray(brands.id, existingIds));

		return { deletedCount: existingIds.length, deletedIds: existingIds, notFoundIds };
	}
}

import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import { marginRules } from "@renovabit/db/schema";
import { MAX_MARGIN_PERCENT } from "@renovabit/pricing";
import { asc, desc, eq, ne } from "drizzle-orm";
import { handleUniqueViolation } from "@/utils/db-helpers";

// ── Types ───────────────────────────────────────────

export type CreateMarginRuleInput = {
	name: string;
	minPrice: number;
	maxPrice?: number | null;
	customerPct: number;
	distributorPct: number;
	sortOrder?: number;
};

export type UpdateMarginRuleInput = Partial<CreateMarginRuleInput>;

// ── Public API ──────────────────────────────────────

async function list() {
	return db
		.select()
		.from(marginRules)
		.orderBy(asc(marginRules.sortOrder), desc(marginRules.createdAt));
}

async function create(data: CreateMarginRuleInput) {
	ensureValidPercent(data.customerPct, "customerPct");
	ensureValidPercent(data.distributorPct, "distributorPct");
	await assertNoOverlap(null, data.minPrice, data.maxPrice ?? null);

	const [row] = await db
		.insert(marginRules)
		.values({
			name: data.name.trim(),
			minPrice: String(data.minPrice),
			maxPrice: data.maxPrice != null ? String(data.maxPrice) : null,
			customerPct: String(data.customerPct),
			distributorPct: String(data.distributorPct),
			sortOrder: data.sortOrder ?? 0,
		})
		.returning()
		.catch((err) => handleUniqueViolation(err, "Ya existe una regla de margen con este nombre"));

	if (!row) {
		throw createApiError({
			code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
			message: "Error al crear la regla de margen",
		});
	}

	return row;
}

async function update(id: string, data: UpdateMarginRuleInput) {
	if (data.name !== undefined && !data.name.trim()) {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: "El nombre de la regla de margen no puede estar vacío",
			logLevel: "info",
			doNotLog: true,
		});
	}
	if (data.customerPct !== undefined) ensureValidPercent(data.customerPct, "customerPct");
	if (data.distributorPct !== undefined) ensureValidPercent(data.distributorPct, "distributorPct");

	const updateData: Record<string, unknown> = {};
	if (data.name !== undefined) updateData.name = data.name.trim();
	if (data.minPrice !== undefined) updateData.minPrice = String(data.minPrice);
	if (data.maxPrice !== undefined) {
		updateData.maxPrice = data.maxPrice != null ? String(data.maxPrice) : null;
	}
	if (data.customerPct !== undefined) updateData.customerPct = String(data.customerPct);
	if (data.distributorPct !== undefined) updateData.distributorPct = String(data.distributorPct);
	if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

	if (Object.keys(updateData).length === 0) {
		const [current] = await db.select().from(marginRules).where(eq(marginRules.id, id)).limit(1);
		if (!current) {
			throw notFound();
		}
		return current;
	}

	// Overlap re-checked only when the range changes.
	if (data.minPrice !== undefined || data.maxPrice !== undefined) {
		const [current] = await db.select().from(marginRules).where(eq(marginRules.id, id)).limit(1);
		if (!current) {
			throw notFound();
		}
		const effectiveMin = data.minPrice !== undefined ? data.minPrice : Number(current.minPrice);
		const effectiveMax =
			data.maxPrice !== undefined
				? (data.maxPrice ?? null)
				: current.maxPrice === null
					? null
					: Number(current.maxPrice);
		await assertNoOverlap(id, effectiveMin, effectiveMax);
	}

	const [row] = await db
		.update(marginRules)
		.set(updateData)
		.where(eq(marginRules.id, id))
		.returning()
		.catch((err) => handleUniqueViolation(err, "Ya existe una regla de margen con este nombre"));

	if (!row) {
		throw notFound();
	}

	return row;
}

async function remove(id: string): Promise<boolean> {
	const [deleted] = await db
		.delete(marginRules)
		.where(eq(marginRules.id, id))
		.returning({ id: marginRules.id });
	return !!deleted;
}

// ── Helpers ──────────────────────────────────────────

function notFound() {
	return createApiError({
		code: BackendErrorCodes.NOT_FOUND_ERROR,
		message: "Regla de margen no encontrada",
		logLevel: "info",
		doNotLog: true,
	});
}

/**
 * Defense-in-depth: validate tier pct even when the service is reached
 * from a non-HTTP caller (job, script, test). TypeBox on the route already
 * enforces [0, 100] for HTTP traffic, but this catches anything else.
 */
function ensureValidPercent(value: number, field: string) {
	if (!Number.isFinite(value) || value < 0 || value > MAX_MARGIN_PERCENT) {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: `El campo ${field} debe estar entre 0 y ${MAX_MARGIN_PERCENT}`,
			logLevel: "info",
			doNotLog: true,
		});
	}
}

/**
 * Pure overlap check. Throws 409 if the given [minPrice, maxPrice] range
 * overlaps any rule in `existingRules`. `maxPrice = null` means +∞.
 *
 * Overlap = existing.minPrice < new.maxPrice AND existing.maxPrice > new.minPrice
 *
 * `excludeId` is used by update to skip the rule being modified.
 *
 * Exported for unit tests; the service wraps it with a DB query.
 */
export function checkOverlap(
	existingRules: ReadonlyArray<{ id: string; minPrice: string; maxPrice: string | null }>,
	minPrice: number,
	maxPrice: number | null,
	excludeId?: string,
): void {
	const newMax = maxPrice ?? Number.POSITIVE_INFINITY;
	for (const existing of existingRules) {
		if (excludeId !== undefined && existing.id === excludeId) continue;
		const existingMin = Number(existing.minPrice);
		const existingMax =
			existing.maxPrice === null ? Number.POSITIVE_INFINITY : Number(existing.maxPrice);
		if (existingMin < newMax && existingMax > minPrice) {
			throw createApiError({
				code: BackendErrorCodes.CONFLICT,
				message:
					"La regla de margen se superpone con una regla existente. Los rangos de precio no pueden solaparse.",
				logLevel: "info",
				doNotLog: true,
			});
		}
	}
}

/**
 * Fetches existing rules and runs the pure overlap check. Used at the
 * service layer (where DB access lives).
 */
async function assertNoOverlap(
	excludeId: string | null,
	minPrice: number,
	maxPrice: number | null,
) {
	const baseQuery = db
		.select({
			id: marginRules.id,
			minPrice: marginRules.minPrice,
			maxPrice: marginRules.maxPrice,
		})
		.from(marginRules);

	const candidates = excludeId
		? await baseQuery.where(ne(marginRules.id, excludeId))
		: await baseQuery;

	checkOverlap(candidates, minPrice, maxPrice, excludeId ?? undefined);
}

// ── Public Service ──────────────────────────────────

export const MarginRulesService = {
	list,
	create,
	update,
	delete: remove,
};

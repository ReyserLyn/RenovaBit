import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import { marginRules, roleMarginRules } from "@renovabit/db/schema";
import { desc, eq } from "drizzle-orm";
import { handleUniqueViolation } from "@/utils/db-helpers";

// ── Types ───────────────────────────────────────────

export type CreateMarginRuleInput = {
	name: string;
	minPrice: number;
	maxPrice?: number | null;
	marginPercent: number;
	sortOrder?: number;
};

export type UpdateMarginRuleInput = Partial<CreateMarginRuleInput>;

export type CreateRoleMarginRuleInput = {
	role: "customer" | "distributor";
	minPrice: number;
	maxPrice?: number | null;
	marginPercent: number;
	sortOrder?: number;
};

export type UpdateRoleMarginRuleInput = Partial<CreateRoleMarginRuleInput>;

// ── Margin Rules (customer tier) ────────────────────

async function list() {
	return db
		.select()
		.from(marginRules)
		.orderBy(desc(marginRules.sortOrder), desc(marginRules.createdAt));
}

async function listRole() {
	return db
		.select()
		.from(roleMarginRules)
		.orderBy(desc(roleMarginRules.sortOrder), desc(roleMarginRules.createdAt));
}

async function create(data: CreateMarginRuleInput) {
	const [row] = await db
		.insert(marginRules)
		.values({
			name: data.name,
			minPrice: String(data.minPrice),
			maxPrice: data.maxPrice != null ? String(data.maxPrice) : null,
			marginPercent: String(data.marginPercent),
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

async function createRole(data: CreateRoleMarginRuleInput) {
	const [row] = await db
		.insert(roleMarginRules)
		.values({
			role: data.role,
			minPrice: String(data.minPrice),
			maxPrice: data.maxPrice != null ? String(data.maxPrice) : null,
			marginPercent: String(data.marginPercent),
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
	const updateData: Record<string, unknown> = {};

	if (data.name !== undefined) updateData.name = data.name;
	if (data.minPrice !== undefined) updateData.minPrice = String(data.minPrice);
	if (data.maxPrice !== undefined) {
		updateData.maxPrice = data.maxPrice != null ? String(data.maxPrice) : null;
	}
	if (data.marginPercent !== undefined) updateData.marginPercent = String(data.marginPercent);
	if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

	if (Object.keys(updateData).length === 0) {
		const [current] = await db.select().from(marginRules).where(eq(marginRules.id, id)).limit(1);
		if (!current) {
			throw createApiError({
				code: BackendErrorCodes.NOT_FOUND_ERROR,
				message: "Regla de margen no encontrada",
				logLevel: "info",
				doNotLog: true,
			});
		}
		return current;
	}

	const [row] = await db
		.update(marginRules)
		.set(updateData)
		.where(eq(marginRules.id, id))
		.returning()
		.catch((err) => handleUniqueViolation(err, "Ya existe una regla de margen con este nombre"));

	if (!row) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Regla de margen no encontrada",
			logLevel: "info",
			doNotLog: true,
		});
	}

	return row;
}

async function updateRole(id: string, data: UpdateRoleMarginRuleInput) {
	const updateData: Record<string, unknown> = {};

	if (data.role !== undefined) updateData.role = data.role;
	if (data.minPrice !== undefined) updateData.minPrice = String(data.minPrice);
	if (data.maxPrice !== undefined) {
		updateData.maxPrice = data.maxPrice != null ? String(data.maxPrice) : null;
	}
	if (data.marginPercent !== undefined) updateData.marginPercent = String(data.marginPercent);
	if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

	if (Object.keys(updateData).length === 0) {
		const [current] = await db
			.select()
			.from(roleMarginRules)
			.where(eq(roleMarginRules.id, id))
			.limit(1);
		if (!current) {
			throw createApiError({
				code: BackendErrorCodes.NOT_FOUND_ERROR,
				message: "Regla de margen no encontrada",
				logLevel: "info",
				doNotLog: true,
			});
		}
		return current;
	}

	const [row] = await db
		.update(roleMarginRules)
		.set(updateData)
		.where(eq(roleMarginRules.id, id))
		.returning()
		.catch((err) => handleUniqueViolation(err, "Ya existe una regla de margen con este nombre"));

	if (!row) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Regla de margen no encontrada",
			logLevel: "info",
			doNotLog: true,
		});
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

async function removeRole(id: string): Promise<boolean> {
	const [deleted] = await db
		.delete(roleMarginRules)
		.where(eq(roleMarginRules.id, id))
		.returning({ id: roleMarginRules.id });
	return !!deleted;
}

export const MarginRulesService = {
	list,
	listRole,
	create,
	createRole,
	update,
	updateRole,
	delete: remove,
	deleteRole: removeRole,
};

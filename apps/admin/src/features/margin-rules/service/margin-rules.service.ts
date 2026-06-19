import { api } from "@/shared/lib/api/api-client";
import { unwrapResponse } from "@/shared/lib/api/api-errors";

// ── Tipos desde la API (Eden Treaty) ──

export interface MarginRule {
	id: string;
	name: string;
	minPrice: string;
	maxPrice: string | null;
	customerPct: string;
	distributorPct: string;
	sortOrder: number;
	createdAt: Date;
	updatedAt: Date;
}

const marginRulesEndpoint = api.api.v1.admin["margin-rules"];

// ── API Functions ────────────────────────────────────

async function list(): Promise<MarginRule[]> {
	return unwrapResponse(marginRulesEndpoint.get());
}

async function create(data: {
	name: string;
	minPrice: number;
	maxPrice?: number | null;
	customerPct: number;
	distributorPct: number;
	sortOrder?: number;
}): Promise<MarginRule> {
	return unwrapResponse(marginRulesEndpoint.post(data));
}

async function update(
	id: string,
	data: {
		name?: string;
		minPrice?: number;
		maxPrice?: number | null;
		customerPct?: number;
		distributorPct?: number;
		sortOrder?: number;
	},
): Promise<MarginRule> {
	return unwrapResponse(marginRulesEndpoint({ id }).put(data));
}

async function remove(id: string): Promise<void> {
	await unwrapResponse(marginRulesEndpoint({ id }).delete());
}

// ── Public API ──

export const marginRulesService = {
	list,
	create,
	update,
	delete: remove,
};

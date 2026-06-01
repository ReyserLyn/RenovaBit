import { api } from "@/shared/lib/api/api-client";
import { unwrapResponse } from "@/shared/lib/api/api-errors";
import type { BlacklistEntry } from "../model";

// ── Body types derivados de Eden Treaty (SSOT con la API) ──

type AddBody = Parameters<typeof api.api.v1.scraping.blacklist.post>[0];
type RemoveBody = Parameters<typeof api.api.v1.scraping.blacklist.delete>[0];

// ── API Functions ────────────────────────────────────

async function list(source?: string): Promise<BlacklistEntry[]> {
	const query = source ? { source } : undefined;
	return unwrapResponse(api.api.v1.scraping.blacklist.get({ query }));
}

async function add(data: AddBody): Promise<{ entry: BlacklistEntry; productDeleted: boolean }> {
	return unwrapResponse(api.api.v1.scraping.blacklist.post(data));
}

async function remove(data: RemoveBody): Promise<{ deleted: boolean }> {
	return unwrapResponse(api.api.v1.scraping.blacklist.delete(data));
}

// ── Public API ──────────────────────────────────────

export const blacklistService = {
	list,
	add,
	remove,
};

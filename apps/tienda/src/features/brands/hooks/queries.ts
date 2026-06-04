import { queryOptions } from "@tanstack/react-query";
import { api, unwrapResponse } from "@/shared/lib/api";

import type { Brand } from "../types";

// ── Query Keys Factory ───────────────────────────────────────

export const brandKeys = {
	all: ["brands"] as const,
	lists: () => [...brandKeys.all, "list"] as const,
	list: () => [...brandKeys.lists()] as const,
	details: () => [...brandKeys.all, "detail"] as const,
	detail: (slug: string) => [...brandKeys.details(), slug] as const,
};

// ── Query Options ─────────────────────────────────────────────

export const brandQueries = {
	/** Lista de marcas activas */
	list: () =>
		queryOptions({
			queryKey: brandKeys.list(),
			queryFn: () => unwrapResponse(api.api.v1.brands.get()),
			staleTime: 1000 * 60 * 10, // 10 min
		}),

	/** Marca por slug */
	bySlug: (slug: string) =>
		queryOptions({
			queryKey: brandKeys.detail(slug),
			queryFn: () => unwrapResponse(api.api.v1.brands({ slug }).get()),
			staleTime: 1000 * 60 * 5, // 5 min
		}),
};

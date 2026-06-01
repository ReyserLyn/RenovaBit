import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/shared/lib/api/api-client";
import { unwrapResponse } from "@/shared/lib/api/api-errors";
import { useDebouncedValue } from "@/shared/lib/hooks/use-debounced-value";

interface ProductSearchResult {
	id: string;
	name: string;
	sku: string;
	providerIds: Array<{ source: string; externalId: string }>;
}

async function searchProducts(query: string): Promise<ProductSearchResult[]> {
	if (!query || query.trim().length < 2) return [];
	const results = await unwrapResponse(
		api.api.v1.products.get({ query: { search: query.trim() } }),
	);
	return results.map((p) => ({
		id: p.id,
		name: p.name,
		sku: p.sku,
		providerIds: p.providerIds ?? [],
	}));
}

export function useProductSearch() {
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, 300);

	const query = useQuery({
		queryKey: ["products", "search", debouncedSearch],
		queryFn: () => searchProducts(debouncedSearch),
		enabled: debouncedSearch.trim().length >= 2,
		staleTime: 1000 * 60, // 1 min
	});

	return {
		search,
		setSearch,
		results: query.data ?? [],
		isLoading: query.isFetching,
	};
}

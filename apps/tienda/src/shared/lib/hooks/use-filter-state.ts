import { parseAsArrayOf, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useCallback, useMemo } from "react";
import { isSortOption, SORT_VALUES } from "@/shared/lib/filters/parsers";

export interface FilterState {
	minPrice: string;
	maxPrice: string;
	hasActiveFilters: boolean;
	onPriceChange: (min: string, max: string) => void;
	onClearAll: () => void;

	sortValue?: string;
	onSortChange?: (value: string) => void;
	selectedBrandSlugs?: string[];
	onBrandToggle?: (slug: string) => void;
}

export interface FilterStateOptions {
	sortable?: boolean;
	brandFilter?: boolean;
}

function toggleBrand(current: string[], slug: string): string[] {
	const next = new Set(current);
	if (next.has(slug)) next.delete(slug);
	else next.add(slug);
	return [...next].sort();
}

export function useFilterState(options?: FilterStateOptions): FilterState {
	const [filters, setFilters] = useQueryStates({
		precio_min: parseAsString.withDefault(""),
		precio_max: parseAsString.withDefault(""),
		orden: parseAsStringLiteral(SORT_VALUES).withDefault("relevance"),
		marcas: parseAsArrayOf(parseAsString).withDefault([]),
	});

	const onPriceChange = useCallback(
		(min: string, max: string) => {
			setFilters({ precio_min: min || null, precio_max: max || null });
		},
		[setFilters],
	);

	const onClearAll = useCallback(() => {
		setFilters({
			orden: "relevance",
			marcas: [],
			precio_min: null,
			precio_max: null,
		});
	}, [setFilters]);

	const onSortChange = useCallback(
		(value: string) => {
			if (isSortOption(value)) setFilters({ orden: value });
		},
		[setFilters],
	);

	const onBrandToggle = useCallback(
		(slug: string) => {
			setFilters({ marcas: toggleBrand(filters.marcas, slug) });
		},
		[setFilters, filters.marcas],
	);

	return useMemo<FilterState>(
		() => ({
			minPrice: filters.precio_min,
			maxPrice: filters.precio_max,
			hasActiveFilters:
				filters.orden !== "relevance" ||
				filters.marcas.length > 0 ||
				filters.precio_min !== "" ||
				filters.precio_max !== "",
			onPriceChange,
			onClearAll,
			...(options?.sortable && { sortValue: filters.orden, onSortChange }),
			...(options?.brandFilter && { selectedBrandSlugs: filters.marcas, onBrandToggle }),
		}),
		[
			filters.precio_min,
			filters.precio_max,
			filters.orden,
			filters.marcas,
			options?.sortable,
			options?.brandFilter,
			onPriceChange,
			onClearAll,
			onSortChange,
			onBrandToggle,
		],
	);
}

// ── Per-page hooks (one-liners) ──────────────────────

export const useCategoryFilterState = () => useFilterState({ sortable: true, brandFilter: true });
export const useBrandFilterState = () => useFilterState({ sortable: true, brandFilter: false });
export const useSearchFilterState = () => useFilterState({ sortable: true, brandFilter: true });
export const useOffersFilterState = () => useFilterState({ sortable: false, brandFilter: true });
export const useFavoritesFilterState = () => useFilterState({ sortable: true, brandFilter: true });

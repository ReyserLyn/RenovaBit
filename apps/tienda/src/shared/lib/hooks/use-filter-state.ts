import { createParser, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useCallback, useMemo } from "react";
import { isSortOption, SORT_VALUES } from "@/shared/lib/filters/parsers";

// Parse comma-separated brand slugs (?marcas=a,b) into string[].
// Matches the format emitted by `normalizeCatalogSearch` in filters/search.ts.
const parseAsBrandSlugs = createParser({
	parse: (value) =>
		value
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean),
	serialize: (value) => value.join(","),
});

/** Base state always returned. */
interface FilterStateBase {
	minPrice: string;
	maxPrice: string;
	hasActiveFilters: boolean;
	onPriceChange: (min: string, max: string) => void;
	onClearAll: () => void;
}

/** State when `sortable: true`. */
interface FilterStateWithSort extends FilterStateBase {
	sortValue: string;
	onSortChange: (value: string) => void;
}

/** State when `brandFilter: true`. */
interface FilterStateWithBrands extends FilterStateBase {
	selectedBrandSlugs: string[];
	onBrandToggle: (slug: string) => void;
}

/** Public type — flags narrow which optional fields are present. */
export type FilterState = FilterStateBase &
	Partial<FilterStateWithSort> &
	Partial<FilterStateWithBrands>;

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

export function useFilterState(): FilterStateBase;
export function useFilterState(options: {
	sortable: true;
	brandFilter?: false;
}): FilterStateWithSort;
export function useFilterState(options: {
	sortable?: false;
	brandFilter: true;
}): FilterStateWithBrands;
export function useFilterState(options: {
	sortable: true;
	brandFilter: true;
}): FilterStateWithSort & FilterStateWithBrands;
export function useFilterState(options?: FilterStateOptions): FilterState;
export function useFilterState(options?: FilterStateOptions): FilterState {
	const [filters, setFilters] = useQueryStates({
		precio_min: parseAsString.withDefault(""),
		precio_max: parseAsString.withDefault(""),
		orden: parseAsStringLiteral(SORT_VALUES).withDefault("relevance"),
		marcas: parseAsBrandSlugs.withDefault([]),
	});

	const onPriceChange = useCallback(
		(min: string, max: string) => {
			setFilters({ precio_min: min || null, precio_max: max || null }, { history: "replace" });
		},
		[setFilters],
	);

	const onClearAll = useCallback(() => {
		setFilters(
			{
				orden: "relevance",
				marcas: [],
				precio_min: null,
				precio_max: null,
			},
			{ history: "replace" },
		);
	}, [setFilters]);

	const onSortChange = useCallback(
		(value: string) => {
			if (isSortOption(value)) setFilters({ orden: value }, { history: "replace" });
		},
		[setFilters],
	);

	const onBrandToggle = useCallback(
		(slug: string) => {
			setFilters({ marcas: toggleBrand(filters.marcas, slug) }, { history: "replace" });
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

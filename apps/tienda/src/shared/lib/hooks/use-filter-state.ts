import { createParser, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useCallback, useMemo } from "react";
import { isSortOption, SORT_VALUES } from "@/shared/lib/filters/parsers";

// Parse comma-separated slugs (?marcas=a,b o ?categorias=a,b) into string[].
// Reused for brands and categories.
const parseAsCommaSlugs = createParser({
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

/** State when `categoryFilter: true`. */
interface FilterStateWithCategories extends FilterStateBase {
	selectedCategorySlugs: string[];
	onCategoryToggle: (slug: string) => void;
}

/** Public type — flags narrow which optional fields are present. */
export type FilterState = FilterStateBase &
	Partial<FilterStateWithSort> &
	Partial<FilterStateWithBrands> &
	Partial<FilterStateWithCategories>;

export interface FilterStateOptions {
	sortable?: boolean;
	brandFilter?: boolean;
	categoryFilter?: boolean;
}

function toggleSlug(current: string[], slug: string): string[] {
	const next = new Set(current);
	if (next.has(slug)) next.delete(slug);
	else next.add(slug);
	return [...next].sort();
}

export function useFilterState(): FilterStateBase;
export function useFilterState(options: {
	sortable: true;
	brandFilter?: false;
	categoryFilter?: false;
}): FilterStateWithSort;
export function useFilterState(options: {
	sortable?: false;
	brandFilter: true;
	categoryFilter?: false;
}): FilterStateWithBrands;
export function useFilterState(options: {
	sortable?: false;
	brandFilter?: false;
	categoryFilter: true;
}): FilterStateWithCategories;
export function useFilterState(options: {
	sortable: true;
	brandFilter: true;
	categoryFilter?: false;
}): FilterStateWithSort & FilterStateWithBrands;
export function useFilterState(options: {
	sortable: true;
	brandFilter?: false;
	categoryFilter: true;
}): FilterStateWithSort & FilterStateWithCategories;
export function useFilterState(options: {
	sortable: true;
	brandFilter: true;
	categoryFilter: true;
}): FilterStateWithSort & FilterStateWithBrands & FilterStateWithCategories;
export function useFilterState(options?: FilterStateOptions): FilterState;
export function useFilterState(options?: FilterStateOptions): FilterState {
	const [filters, setFilters] = useQueryStates({
		precio_min: parseAsString.withDefault(""),
		precio_max: parseAsString.withDefault(""),
		orden: parseAsStringLiteral(SORT_VALUES).withDefault("relevance"),
		marcas: parseAsCommaSlugs.withDefault([]),
		categorias: parseAsCommaSlugs.withDefault([]),
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
				// null = borrar el param de la URL (no "?marcas=&categorias=")
				marcas: null,
				categorias: null,
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
			const next = toggleSlug(filters.marcas, slug);
			// null cuando se queda vacío → nuqs borra el param de la URL
			setFilters({ marcas: next.length > 0 ? next : null }, { history: "replace" });
		},
		[setFilters, filters.marcas],
	);

	const onCategoryToggle = useCallback(
		(slug: string) => {
			const next = toggleSlug(filters.categorias, slug);
			setFilters({ categorias: next.length > 0 ? next : null }, { history: "replace" });
		},
		[setFilters, filters.categorias],
	);

	return useMemo<FilterState>(
		() => ({
			minPrice: filters.precio_min,
			maxPrice: filters.precio_max,
			hasActiveFilters:
				filters.orden !== "relevance" ||
				filters.marcas.length > 0 ||
				filters.categorias.length > 0 ||
				filters.precio_min !== "" ||
				filters.precio_max !== "",
			onPriceChange,
			onClearAll,
			...(options?.sortable && { sortValue: filters.orden, onSortChange }),
			...(options?.brandFilter && { selectedBrandSlugs: filters.marcas, onBrandToggle }),
			...(options?.categoryFilter && {
				selectedCategorySlugs: filters.categorias,
				onCategoryToggle,
			}),
		}),
		[
			filters.precio_min,
			filters.precio_max,
			filters.orden,
			filters.marcas,
			filters.categorias,
			options?.sortable,
			options?.brandFilter,
			options?.categoryFilter,
			onPriceChange,
			onClearAll,
			onSortChange,
			onBrandToggle,
			onCategoryToggle,
		],
	);
}

// ── Per-page hooks (one-liners) ──────────────────────

export const useCategoryFilterState = () => useFilterState({ sortable: true, brandFilter: true });
export const useBrandFilterState = () => useFilterState({ sortable: true, brandFilter: false });
export const useSearchFilterState = () => useFilterState({ sortable: true, brandFilter: true });
export const useOffersFilterState = () => useFilterState({ sortable: false, brandFilter: true });
export const useFavoritesFilterState = () => useFilterState({ sortable: true, brandFilter: true });
/** /productos — sort + brand + category (multi-select de hojas) */
export const useProductsFilterState = () =>
	useFilterState({ sortable: true, brandFilter: true, categoryFilter: true });

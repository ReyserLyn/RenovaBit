import type { ColumnFiltersState } from "@tanstack/react-table";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type { Brand } from "@/features/brands/model";
import type { Category } from "@/features/categories/model";
import { useProductFilters } from "./use-product-filters";

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Hook que encapsula toda la lógica de filtros para la tabla de productos:
 * - Filtros persistidos en URL (nuqs)
 * - Búsqueda con debounce
 * - Sincronización nuqs → TanStack columnFilters
 * - Handlers de cambio/limpieza con startTransition
 */
export function useProductTableFilters(
	brandsBySlug: Map<string, Brand>,
	categoriesBySlug: Map<string, Category>,
) {
	const filters = useProductFilters();

	// ── Debounced search ─────────────────────────────
	const searchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const [localSearch, setLocalSearch] = useState(filters.search);

	useEffect(() => {
		setLocalSearch(filters.search);
	}, [filters.search]);

	const handleSearchChange = useCallback(
		(value: string) => {
			setLocalSearch(value);
			clearTimeout(searchTimerRef.current);
			searchTimerRef.current = setTimeout(() => {
				filters.setSearch(value);
			}, SEARCH_DEBOUNCE_MS);
		},
		[filters.setSearch],
	);

	useEffect(() => {
		return () => clearTimeout(searchTimerRef.current);
	}, []);

	// ── Filter handlers ──────────────────────────────

	const handleBrandChange = useCallback(
		(value: string | null) => {
			startTransition(() => {
				void filters.setBrandSlug(value === "all" ? null : value);
			});
		},
		[filters.setBrandSlug],
	);

	const handleCategoryChange = useCallback(
		(value: string | null) => {
			startTransition(() => {
				void filters.setCategorySlug(value === "all" ? null : value);
			});
		},
		[filters.setCategorySlug],
	);

	const handleStatusChange = useCallback(
		(value: string | null) => {
			const next = (value ?? "all") as "all" | "active" | "inactive";
			startTransition(() => {
				void filters.setStatus(next);
			});
		},
		[filters.setStatus],
	);

	const handleClearFilters = useCallback(() => {
		startTransition(() => {
			void filters.setBrandSlug(null);
			void filters.setCategorySlug(null);
			void filters.setStatus("all");
			void filters.setSearch("");
		});
	}, [filters.setBrandSlug, filters.setCategorySlug, filters.setStatus, filters.setSearch]);

	const handleRemoveBrandFilter = useCallback(
		() => startTransition(() => void filters.setBrandSlug(null)),
		[filters.setBrandSlug],
	);
	const handleRemoveCategoryFilter = useCallback(
		() => startTransition(() => void filters.setCategorySlug(null)),
		[filters.setCategorySlug],
	);
	const handleRemoveStatusFilter = useCallback(
		() => startTransition(() => void filters.setStatus("all")),
		[filters.setStatus],
	);

	// ── Column filters sync (nuqs → TanStack) ────────

	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

	useEffect(() => {
		const next: ColumnFiltersState = [];

		if (filters.brandSlug) {
			const brand = brandsBySlug.get(filters.brandSlug);
			if (brand) next.push({ id: "brand", value: brand.id });
		}
		if (filters.categorySlug) {
			const category = categoriesBySlug.get(filters.categorySlug);
			if (category) next.push({ id: "category", value: category.id });
		}
		if (filters.status === "active") {
			next.push({ id: "isActive", value: true });
		} else if (filters.status === "inactive") {
			next.push({ id: "isActive", value: false });
		}

		setColumnFilters(next);
	}, [filters.brandSlug, filters.categorySlug, filters.status, brandsBySlug, categoriesBySlug]);

	// ── Derived labels ───────────────────────────────

	const selectedBrand = filters.brandSlug ? brandsBySlug.get(filters.brandSlug) : null;
	const selectedCategory = filters.categorySlug ? categoriesBySlug.get(filters.categorySlug) : null;

	const brandLabel = selectedBrand?.name ?? "Todas las marcas";
	const categoryLabel = selectedCategory?.name ?? "Todas las categorías";
	const statusLabel =
		filters.status === "active" ? "Activos" : filters.status === "inactive" ? "Inactivos" : "Todos";

	const hasActiveFilters =
		!!filters.brandSlug || !!filters.categorySlug || filters.status !== "all" || !!filters.search;

	return {
		filters,
		localSearch,
		handleSearchChange,
		handleBrandChange,
		handleCategoryChange,
		handleStatusChange,
		handleClearFilters,
		handleRemoveBrandFilter,
		handleRemoveCategoryFilter,
		handleRemoveStatusFilter,
		columnFilters,
		setColumnFilters,
		brandLabel,
		categoryLabel,
		statusLabel,
		hasActiveFilters,
	} as const;
}

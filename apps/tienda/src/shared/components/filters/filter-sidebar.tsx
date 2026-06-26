import { FilterIcon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { Checkbox } from "@renovabit/ui/components/ui/checkbox";
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@renovabit/ui/components/ui/drawer";
import { Input } from "@renovabit/ui/components/ui/input";
import { Label } from "@renovabit/ui/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@renovabit/ui/components/ui/select";
import { Separator } from "@renovabit/ui/components/ui/separator";
import { cn } from "@renovabit/ui/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { isSortOption, SORT_OPTIONS } from "@/shared/lib/filters/parsers";
import { useDebouncedValue } from "@/shared/lib/hooks/use-debounced-value";

const PRICE_INPUT_PATTERN = /^\d*(\.\d{0,2})?$/;

export interface BrandFilterItem {
	id: string;
	name: string;
	slug: string;
	productCount?: number;
}

export interface CategoryFilterItem {
	id: string;
	name: string;
	slug: string;
	productCount?: number;
}

export interface IndexItem {
	id: string;
	label: string;
}

/**
 * Controlled sidebar. Each section renders only if the page provides
 * the corresponding handler — no `showSort`/`showBrand` flags and no
 * noop handlers. Pass `undefined` (or just omit) to hide a section.
 */
export interface FilterSidebarProps {
	// Data
	brands?: BrandFilterItem[];
	categories?: CategoryFilterItem[];
	indexItems?: IndexItem[];
	sortValue?: string;
	selectedBrandSlugs?: string[];
	selectedCategorySlugs?: string[];
	minPrice?: string;
	maxPrice?: string;
	hasActiveFilters?: boolean;

	// Handlers (optional — section visibility is derived from presence)
	onSortChange?: (value: string) => void;
	onBrandToggle?: (slug: string) => void;
	onCategoryToggle?: (slug: string) => void;
	onPriceChange?: (min: string, max: string) => void;
	onClearAll?: () => void;

	className?: string;
}

export function FilterSidebar({
	brands,
	categories,
	indexItems,
	sortValue = "price_asc",
	selectedBrandSlugs = [],
	selectedCategorySlugs = [],
	minPrice = "",
	maxPrice = "",
	hasActiveFilters = false,
	onSortChange,
	onBrandToggle,
	onCategoryToggle,
	onPriceChange,
	onClearAll,
	className,
}: FilterSidebarProps) {
	const [brandSearch, setBrandSearch] = useState("");
	const [categorySearch, setCategorySearch] = useState("");
	const [mobileOpen, setMobileOpen] = useState(false);

	const [localMinPrice, setLocalMinPrice] = useState(minPrice);
	const [localMaxPrice, setLocalMaxPrice] = useState(maxPrice);

	useEffect(() => {
		setLocalMinPrice(minPrice);
		setLocalMaxPrice(maxPrice);
	}, [minPrice, maxPrice]);

	const hasPriceError =
		localMinPrice !== "" && localMaxPrice !== "" && Number(localMinPrice) > Number(localMaxPrice);

	const debouncedMin = useDebouncedValue(localMinPrice, 400);
	const debouncedMax = useDebouncedValue(localMaxPrice, 400);

	const prevMin = useRef(debouncedMin);
	const prevMax = useRef(debouncedMax);

	useEffect(() => {
		if (!onPriceChange) return;
		const updates: { min?: string; max?: string } = {};
		if (prevMin.current !== debouncedMin) {
			prevMin.current = debouncedMin;
			updates.min = debouncedMin;
		}
		if (prevMax.current !== debouncedMax) {
			prevMax.current = debouncedMax;
			updates.max = debouncedMax;
		}
		if (updates.min !== undefined || updates.max !== undefined) {
			onPriceChange(updates.min ?? minPrice, updates.max ?? maxPrice);
		}
	}, [debouncedMin, debouncedMax, onPriceChange, minPrice, maxPrice]);

	const selectedBrands = useMemo(() => new Set(selectedBrandSlugs), [selectedBrandSlugs]);
	const selectedCategories = useMemo(() => new Set(selectedCategorySlugs), [selectedCategorySlugs]);

	const filteredBrands = useMemo(() => {
		const q = brandSearch.trim().toLowerCase();
		if (!q || !brands) return brands ?? [];
		return brands.filter((brand) => brand.name.toLowerCase().includes(q));
	}, [brands, brandSearch]);

	const filteredCategories = useMemo(() => {
		const q = categorySearch.trim().toLowerCase();
		if (!q || !categories) return categories ?? [];
		return categories.filter((cat) => cat.name.toLowerCase().includes(q));
	}, [categories, categorySearch]);

	// Section visibility derived from handler + data presence
	const showSort = onSortChange !== undefined;
	const showPrice = onPriceChange !== undefined;
	const showBrand = onBrandToggle !== undefined && brands !== undefined && brands.length > 0;
	const showCategory =
		onCategoryToggle !== undefined && categories !== undefined && categories.length > 0;
	const showIndex = indexItems !== undefined && indexItems.length > 0;

	function handleSortChange(value: string | null) {
		if (!onSortChange) return;
		if (value && isSortOption(value)) onSortChange(value);
		setMobileOpen(false);
	}

	function handleBrandToggle(slug: string) {
		onBrandToggle?.(slug);
	}

	function handleCategoryToggle(slug: string) {
		onCategoryToggle?.(slug);
	}

	function handleMinPriceChange(value: string) {
		if (PRICE_INPUT_PATTERN.test(value)) setLocalMinPrice(value);
	}

	function handleMaxPriceChange(value: string) {
		if (PRICE_INPUT_PATTERN.test(value)) setLocalMaxPrice(value);
	}

	function handleClearAll() {
		onClearAll?.();
		setLocalMinPrice("");
		setLocalMaxPrice("");
		setBrandSearch("");
		setCategorySearch("");
	}

	const filterContent = (
		<div className="space-y-5">
			<div className="flex items-center justify-between">
				<h3 className="text-sm font-semibold tracking-tight">Filtros</h3>
				{hasActiveFilters && (
					<button
						type="button"
						onClick={handleClearAll}
						className="text-muted-foreground hover:text-foreground cursor-pointer text-xs transition-colors"
					>
						Limpiar todo
					</button>
				)}
			</div>

			<Separator />

			{showSort && (
				<div className="space-y-2">
					<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Ordenar por
					</Label>
					<Select items={SORT_OPTIONS} value={sortValue} onValueChange={handleSortChange}>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent side="bottom" align="start">
							<SelectGroup>
								{SORT_OPTIONS.map((opt) => (
									<SelectItem key={opt.value} value={opt.value}>
										{opt.label}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</div>
			)}

			{showSort && (showPrice || showBrand || showCategory || showIndex) && <Separator />}

			{showPrice && (
				<div className="space-y-2">
					<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Precio
					</Label>
					<div className="flex items-center gap-2">
						<Input
							type="text"
							inputMode="decimal"
							placeholder="S/ 0"
							className={cn("h-8 text-xs", hasPriceError && "border-destructive")}
							value={localMinPrice}
							onChange={(e) => handleMinPriceChange(e.target.value)}
						/>
						<span className="text-muted-foreground text-xs">—</span>
						<Input
							type="text"
							inputMode="decimal"
							placeholder="S/ 9999"
							className={cn("h-8 text-xs", hasPriceError && "border-destructive")}
							value={localMaxPrice}
							onChange={(e) => handleMaxPriceChange(e.target.value)}
						/>
					</div>
					{hasPriceError && (
						<p className="text-destructive text-xs">
							El precio mínimo no puede ser mayor al máximo
						</p>
					)}
				</div>
			)}

			{showPrice && (showBrand || showCategory || showIndex) && <Separator />}

			{showBrand && brands && (
				<div className="space-y-2">
					<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Marca
					</Label>
					{brands.length > 8 && (
						<div className="relative mb-2">
							<HugeiconsIcon
								icon={Search01Icon}
								size={14}
								className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								aria-label="Buscar marca"
								placeholder="Buscar marca..."
								className="h-8 pl-7 text-xs"
								value={brandSearch}
								onChange={(e) => setBrandSearch(e.target.value)}
							/>
						</div>
					)}
					<div className="max-h-48 space-y-1 overflow-y-auto">
						{filteredBrands.map((brand) => {
							const checkboxId = `brand-filter-${brand.id}`;
							return (
								<div
									key={brand.id}
									className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-accent/50 transition-colors"
								>
									<Checkbox
										id={checkboxId}
										checked={selectedBrands.has(brand.slug)}
										onCheckedChange={() => handleBrandToggle(brand.slug)}
									/>
									<Label htmlFor={checkboxId} className="flex flex-1 cursor-pointer items-center">
										<span className="truncate">{brand.name}</span>
									</Label>
									{brand.productCount !== undefined && (
										<span className="text-muted-foreground tabular-nums">
											({brand.productCount})
										</span>
									)}
								</div>
							);
						})}
						{filteredBrands.length === 0 && (
							<p className="text-muted-foreground py-2 text-xs text-center">Sin resultados</p>
						)}
					</div>
				</div>
			)}

			{showCategory && (showBrand || showIndex) && <Separator />}

			{showCategory && categories && (
				<div className="space-y-2">
					<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Categoría
					</Label>
					{categories.length > 8 && (
						<div className="relative mb-2">
							<HugeiconsIcon
								icon={Search01Icon}
								size={14}
								className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								aria-label="Buscar categoría"
								placeholder="Buscar categoría..."
								className="h-8 pl-7 text-xs"
								value={categorySearch}
								onChange={(e) => setCategorySearch(e.target.value)}
							/>
						</div>
					)}
					<div className="max-h-48 space-y-1 overflow-y-auto">
						{filteredCategories.map((cat) => {
							const checkboxId = `category-filter-${cat.id}`;
							return (
								<div
									key={cat.id}
									className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-accent/50 transition-colors"
								>
									<Checkbox
										id={checkboxId}
										checked={selectedCategories.has(cat.slug)}
										onCheckedChange={() => handleCategoryToggle(cat.slug)}
									/>
									<Label htmlFor={checkboxId} className="flex flex-1 cursor-pointer items-center">
										<span className="truncate">{cat.name}</span>
									</Label>
									{cat.productCount !== undefined && (
										<span className="text-muted-foreground tabular-nums">({cat.productCount})</span>
									)}
								</div>
							);
						})}
						{filteredCategories.length === 0 && (
							<p className="text-muted-foreground py-2 text-xs text-center">Sin resultados</p>
						)}
					</div>
				</div>
			)}

			{showBrand && showIndex && <Separator />}

			{showCategory && showIndex && <Separator />}

			{showIndex && indexItems && (
				<div className="space-y-2">
					<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Índice
					</Label>
					<nav className="space-y-1" aria-label="Navegación de la página">
						{indexItems.map((item) => (
							<a
								key={item.id}
								href={`#${item.id}`}
								className="block rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors truncate"
							>
								{item.label}
							</a>
						))}
					</nav>
				</div>
			)}
		</div>
	);

	return (
		<>
			<div className="lg:hidden">
				<Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
					<DrawerTrigger asChild>
						<Button variant="outline" size="sm" aria-haspopup="dialog" aria-expanded={mobileOpen}>
							<HugeiconsIcon icon={FilterIcon} size={16} />
							Filtros
						</Button>
					</DrawerTrigger>
					<DrawerContent>
						<DrawerHeader>
							<DrawerTitle>Filtros</DrawerTitle>
						</DrawerHeader>
						<div className="px-4 pb-6">{filterContent}</div>
					</DrawerContent>
				</Drawer>
			</div>

			<aside className={cn("hidden w-full shrink-0 space-y-5 lg:block lg:w-64", className)}>
				<div className="rounded-xl border border-border bg-card p-4">{filterContent}</div>
			</aside>
		</>
	);
}

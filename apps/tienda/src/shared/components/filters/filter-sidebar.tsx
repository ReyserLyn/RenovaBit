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
import { useQueryStates } from "nuqs";
import { useEffect, useMemo, useRef, useState } from "react";
import { isSortOption, productFilterParsers, SORT_OPTIONS } from "@/shared/lib/filters/parsers";
import { useDebouncedValue } from "@/shared/lib/hooks/use-debounced-value";

const PRICE_INPUT_PATTERN = /^\d*(\.\d{0,2})?$/;

export interface BrandFilterItem {
	id: string;
	name: string;
	slug: string;
	productCount: number;
}

interface FilterSidebarProps {
	brands?: BrandFilterItem[];
	className?: string;
}

function isValidPriceInput(value: string): boolean {
	return PRICE_INPUT_PATTERN.test(value);
}

export function FilterSidebar({ brands = [], className }: FilterSidebarProps) {
	const [filters, setFilters] = useQueryStates(productFilterParsers);
	const [brandSearch, setBrandSearch] = useState("");
	const [mobileOpen, setMobileOpen] = useState(false);

	const [localMinPrice, setLocalMinPrice] = useState(filters.precio_min);
	const [localMaxPrice, setLocalMaxPrice] = useState(filters.precio_max);

	useEffect(() => {
		setLocalMinPrice(filters.precio_min);
		setLocalMaxPrice(filters.precio_max);
	}, [filters.precio_min, filters.precio_max]);

	const hasPriceError =
		localMinPrice !== "" && localMaxPrice !== "" && Number(localMinPrice) > Number(localMaxPrice);

	const debouncedMin = useDebouncedValue(localMinPrice, 400);
	const debouncedMax = useDebouncedValue(localMaxPrice, 400);

	const prevMin = useRef(debouncedMin);
	const prevMax = useRef(debouncedMax);

	useEffect(() => {
		const updates: { precio_min?: string | null; precio_max?: string | null } = {};

		if (prevMin.current !== debouncedMin) {
			prevMin.current = debouncedMin;
			updates.precio_min = debouncedMin || null;
		}

		if (prevMax.current !== debouncedMax) {
			prevMax.current = debouncedMax;
			updates.precio_max = debouncedMax || null;
		}

		if (Object.keys(updates).length > 0) {
			void setFilters(updates, { history: "replace" });
		}
	}, [debouncedMin, debouncedMax, setFilters]);

	const hasActiveFilters = useMemo(
		() =>
			filters.orden !== "relevance" ||
			filters.precio_min !== "" ||
			filters.precio_max !== "" ||
			filters.marcas.length > 0,
		[filters],
	);

	const selectedBrands = useMemo(() => new Set(filters.marcas), [filters.marcas]);

	const filteredBrands = useMemo(() => {
		const q = brandSearch.trim().toLowerCase();
		if (!q) return brands;
		return brands.filter((brand) => brand.name.toLowerCase().includes(q));
	}, [brands, brandSearch]);

	function handleSortChange(value: string | null) {
		if (value && isSortOption(value)) void setFilters({ orden: value });
		setMobileOpen(false);
	}

	function handleBrandToggle(slug: string) {
		const next = new Set(filters.marcas);
		if (next.has(slug)) next.delete(slug);
		else next.add(slug);
		void setFilters({ marcas: Array.from(next) });
	}

	function handleMinPriceChange(value: string) {
		if (isValidPriceInput(value)) setLocalMinPrice(value);
	}

	function handleMaxPriceChange(value: string) {
		if (isValidPriceInput(value)) setLocalMaxPrice(value);
	}

	function handleClearAll() {
		void setFilters(
			{
				orden: "relevance",
				marcas: [],
				precio_min: null,
				precio_max: null,
			},
			{ history: "replace" },
		);
		setLocalMinPrice("");
		setLocalMaxPrice("");
		setBrandSearch("");
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

			<div className="space-y-2">
				<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Ordenar por
				</Label>
				<Select items={SORT_OPTIONS} value={filters.orden} onValueChange={handleSortChange}>
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

			<Separator />

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
						El precio m\u00ednimo no puede ser mayor al m\u00e1ximo
					</p>
				)}
			</div>

			{brands.length > 0 && (
				<>
					<Separator />
					<div className="space-y-2">
						<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Marca
						</Label>
						<div className="relative mb-2">
							<HugeiconsIcon
								icon={Search01Icon}
								size={14}
								className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								placeholder="Buscar marca..."
								className="h-8 pl-7 text-xs"
								value={brandSearch}
								onChange={(e) => setBrandSearch(e.target.value)}
							/>
						</div>
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
										<span className="text-muted-foreground tabular-nums">
											({brand.productCount})
										</span>
									</div>
								);
							})}
							{filteredBrands.length === 0 && (
								<p className="text-muted-foreground py-2 text-xs text-center">Sin resultados</p>
							)}
						</div>
					</div>
				</>
			)}
		</div>
	);

	return (
		<>
			<div className="lg:hidden">
				<Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
					<DrawerTrigger asChild>
						<Button variant="outline" size="sm">
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

import { ArrowDown01Icon, FilterIcon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@renovabit/ui/components/ui/button";
import { Input } from "@renovabit/ui/components/ui/input";
import { Label } from "@renovabit/ui/components/ui/label";
import { Separator } from "@renovabit/ui/components/ui/separator";
import { cn } from "@renovabit/ui/lib/utils";
import { useState } from "react";

// ── Placeholder data ─────────────────────────────

const MOCK_BRANDS = [
	{ id: "1", name: "Thermaltake", count: 12 },
	{ id: "2", name: "Corsair", count: 8 },
	{ id: "3", name: "AMD", count: 15 },
	{ id: "4", name: "Intel", count: 10 },
	{ id: "5", name: "NVIDIA", count: 6 },
	{ id: "6", name: "ASUS", count: 9 },
];

const SORT_OPTIONS = [
	{ value: "relevance", label: "Relevancia" },
	{ value: "price-asc", label: "Precio: menor a mayor" },
	{ value: "price-desc", label: "Precio: mayor a menor" },
	{ value: "name-asc", label: "Nombre: A-Z" },
	{ value: "name-desc", label: "Nombre: Z-A" },
	{ value: "newest", label: "Más nuevos primero" },
];

// ── Component ────────────────────────────────────

interface FilterSidebarProps {
	className?: string;
}

export function FilterSidebar({ className }: FilterSidebarProps) {
	const [mobileOpen, setMobileOpen] = useState(false);

	return (
		<>
			{/* ── Botón móvil ──────────────────────── */}
			<Button
				variant="outline"
				size="sm"
				className="lg:hidden"
				onClick={() => setMobileOpen(!mobileOpen)}
			>
				<HugeiconsIcon icon={FilterIcon} size={16} />
				Filtros
			</Button>

			{/* ── Sidebar ──────────────────────────── */}
			<aside
				className={cn(
					"w-full shrink-0 space-y-5 lg:w-64 lg:block",
					mobileOpen ? "mt-3 block" : "hidden",
					className,
				)}
			>
				<div className="rounded-xl border border-border bg-card p-4">
					{/* Header */}
					<div className="flex items-center justify-between">
						<h3 className="text-sm font-semibold tracking-tight">Filtros</h3>
						<button
							type="button"
							className="text-muted-foreground hover:text-foreground text-xs transition-colors"
						>
							Limpiar todo
						</button>
					</div>

					<Separator className="my-4" />

					{/* Ordenar por */}
					<div className="space-y-2">
						<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Ordenar por
						</Label>
						<div className="relative">
							<select
								className="ring-offset-background focus-visible:ring-ring flex h-8 w-full appearance-none rounded-lg border border-input px-2.5 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-1"
								disabled
							>
								{SORT_OPTIONS.map((opt) => (
									<option key={opt.value} value={opt.value}>
										{opt.label}
									</option>
								))}
							</select>
							<HugeiconsIcon
								icon={ArrowDown01Icon}
								size={14}
								className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
							/>
						</div>
					</div>

					<Separator className="my-4" />

					{/* Precio */}
					<div className="space-y-2">
						<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Precio
						</Label>
						<div className="flex items-center gap-2">
							<Input type="number" placeholder="S/ 0" className="h-8 text-xs" disabled />
							<span className="text-muted-foreground text-xs">—</span>
							<Input type="number" placeholder="S/ 9999" className="h-8 text-xs" disabled />
						</div>
					</div>

					<Separator className="my-4" />

					{/* Marca */}
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
							<Input placeholder="Buscar marca..." className="h-8 pl-7 text-xs" disabled />
						</div>
						<div className="max-h-48 space-y-1 overflow-y-auto">
							{MOCK_BRANDS.map((brand) => (
								<label
									key={brand.id}
									className="flex cursor-not-allowed items-center gap-2 rounded-md px-1.5 py-1 text-xs opacity-50"
								>
									<input
										type="checkbox"
										className="border-input accent-primary size-3.5 rounded-md"
										disabled
									/>
									<span className="flex-1 truncate">{brand.name}</span>
									<span className="text-muted-foreground tabular-nums">({brand.count})</span>
								</label>
							))}
						</div>
					</div>

					<Separator className="my-4" />

					{/* Disponibilidad */}
					<div className="space-y-2">
						<Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Disponibilidad
						</Label>
						<label className="flex cursor-not-allowed items-center gap-2 rounded-md px-1.5 py-1 text-xs opacity-50">
							<input
								type="checkbox"
								className="border-input accent-primary size-3.5 rounded-md"
								disabled
							/>
							Solo productos en stock
						</label>
					</div>

					<Separator className="my-4" />

					{/* Aplicar */}
					<Button variant="default" size="sm" className="w-full" disabled>
						Aplicar filtros
					</Button>
				</div>
			</aside>
		</>
	);
}

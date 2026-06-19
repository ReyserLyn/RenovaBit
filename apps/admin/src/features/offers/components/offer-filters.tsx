import { Button } from "@renovabit/ui/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@renovabit/ui/components/ui/select";
import { startTransition, useMemo } from "react";
import { DatePicker } from "@/shared/components/date-picker";
import type { OfferFilters } from "../hooks/use-offer-filters";

const statusFilterItems = [
	{ value: "all", label: "Todas" },
	{ value: "true", label: "Activas" },
	{ value: "false", label: "Inactivas" },
] as const;

const featuredFilterItems = [
	{ value: "all", label: "Todas" },
	{ value: "true", label: "Destacadas" },
	{ value: "false", label: "No destacadas" },
] as const;

interface OfferFiltersBarProps {
	filters: OfferFilters;
}

export function OfferFiltersBar({ filters }: OfferFiltersBarProps) {
	const fromDate = useMemo(
		() => (filters.from ? new Date(`${filters.from}T00:00:00`) : undefined),
		[filters.from],
	);
	const toDate = useMemo(
		() => (filters.to ? new Date(`${filters.to}T00:00:00`) : undefined),
		[filters.to],
	);

	const hasActiveFilters =
		filters.isActive !== "all" ||
		filters.isFeatured !== "all" ||
		!!filters.from ||
		!!filters.to ||
		filters.search.length > 0;

	const handleClearFilters = () => {
		startTransition(() => {
			void filters.setIsActive("all");
			void filters.setIsFeatured("all");
			void filters.setFrom(null);
			void filters.setTo(null);
			void filters.setSearch("");
		});
	};

	const handleFromChange = (date: Date | undefined) => {
		startTransition(() => {
			const iso = date ? date.toISOString().slice(0, 10) : null;
			void filters.setFrom(iso);
		});
	};

	const handleToChange = (date: Date | undefined) => {
		startTransition(() => {
			const iso = date ? date.toISOString().slice(0, 10) : null;
			void filters.setTo(iso);
		});
	};

	return (
		<div className="flex flex-wrap items-end gap-2">
			<div className="flex flex-col gap-1.5">
				<label className="text-muted-foreground text-xs font-medium">Estado</label>
				<Select
					items={statusFilterItems}
					value={filters.isActive}
					onValueChange={(value) => {
						startTransition(() => {
							void filters.setIsActive(value);
						});
					}}
				>
					<SelectTrigger className="h-8 w-[130px] bg-card">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{statusFilterItems.map((item) => (
							<SelectItem key={item.value} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="flex flex-col gap-1.5">
				<label className="text-muted-foreground text-xs font-medium">Destacado</label>
				<Select
					items={featuredFilterItems}
					value={filters.isFeatured}
					onValueChange={(value) => {
						startTransition(() => {
							void filters.setIsFeatured(value);
						});
					}}
				>
					<SelectTrigger className="h-8 w-[140px] bg-card">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{featuredFilterItems.map((item) => (
							<SelectItem key={item.value} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="flex flex-col gap-1.5">
				<label className="text-muted-foreground text-xs font-medium">Desde</label>
				<DatePicker value={fromDate} onChange={handleFromChange} disabledAfter={toDate} />
			</div>

			<div className="flex flex-col gap-1.5">
				<label className="text-muted-foreground text-xs font-medium">Hasta</label>
				<DatePicker value={toDate} onChange={handleToChange} disabledBefore={fromDate} />
			</div>

			{hasActiveFilters && (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-8 text-xs"
					onClick={handleClearFilters}
				>
					Limpiar filtros
				</Button>
			)}
		</div>
	);
}

import { getEffectiveSalePrice, type MarginRule } from "@renovabit/pricing";
import { Badge } from "@renovabit/ui/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@renovabit/ui/components/ui/card";
import { Skeleton } from "@renovabit/ui/components/ui/skeleton";
import { useMemo } from "react";
import { formatCurrency } from "@/shared/lib/format-currency";

// ── Types ───────────────────────────────────────────────

type ProductMarginPreviewProps = {
	supplierPrice: string;
	customerEnabled: boolean;
	customerPercent: string;
	distributorEnabled: boolean;
	distributorPercent: string;
	marginRules: MarginRule[] | undefined;
};

type SourceBadgeConfig = {
	label: string;
	variant: "default" | "secondary" | "outline" | "warning" | "info";
};

const SOURCE_BADGE_MAP: Record<string, SourceBadgeConfig> = {
	"per-product-override": { label: "Override", variant: "default" },
	tier: { label: "Regla", variant: "secondary" },
	"default-fallback": { label: "Default", variant: "outline" },
	"no-supplier-price": { label: "Sin costo", variant: "warning" },
	"admin-raw": { label: "Admin", variant: "info" },
};

const DEFAULT_BADGE: SourceBadgeConfig = { label: "Default", variant: "outline" };

// ── Helpers ─────────────────────────────────────────────

function getSourceBadge(source: string): SourceBadgeConfig {
	return SOURCE_BADGE_MAP[source] ?? DEFAULT_BADGE;
}

function formatPercent(value: number): string {
	if (value === 0) return "—";
	return `${value.toFixed(2)}%`;
}

// ── Row ─────────────────────────────────────────────────

function PriceRow({
	label,
	price,
	percent,
	source,
}: {
	label: string;
	price: string;
	percent: string;
	source: string;
}) {
	const badge = getSourceBadge(source);
	const isPlaceholder = source === "no-supplier-price" || price === "S/ 0.00";

	return (
		<div className="flex items-center justify-between gap-4">
			<div className="flex min-w-0 flex-col gap-0.5">
				<span className="text-muted-foreground text-xs font-medium">{label}</span>
				<span
					className={`font-mono tabular-nums text-sm ${
						isPlaceholder ? "text-muted-foreground" : "text-foreground"
					}`}
				>
					{isPlaceholder ? "—" : price}
				</span>
			</div>
			<div className="flex shrink-0 items-center gap-2">
				{percent !== "—" && (
					<span className="text-muted-foreground font-mono tabular-nums text-xs">{percent}</span>
				)}
				<Badge variant={badge.variant} size="xs">
					{badge.label}
				</Badge>
			</div>
		</div>
	);
}

// ── Component ───────────────────────────────────────────

export function ProductMarginPreview({
	supplierPrice,
	customerEnabled,
	customerPercent,
	distributorEnabled,
	distributorPercent,
	marginRules,
}: ProductMarginPreviewProps) {
	const result = useMemo(() => {
		if (marginRules === undefined) return null;

		const product = {
			supplierPrice,
			roleCustomMargins: (() => {
				const m: Record<string, { enabled: true; percent: string }> = {};
				if (customerEnabled && customerPercent.length > 0) {
					m.customer = { enabled: true, percent: customerPercent };
				}
				if (distributorEnabled && distributorPercent.length > 0) {
					m.distributor = { enabled: true, percent: distributorPercent };
				}
				return Object.keys(m).length > 0 ? m : undefined;
			})(),
		};

		const customerResult = getEffectiveSalePrice(product, "customer", marginRules);
		const distributorResult = getEffectiveSalePrice(product, "distributor", marginRules);

		return { customerResult, distributorResult };
	}, [
		supplierPrice,
		customerEnabled,
		customerPercent,
		distributorEnabled,
		distributorPercent,
		marginRules,
	]);

	if (marginRules === undefined) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-sm">Vista previa de precios</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col gap-3">
						<Skeleton className="h-8 w-full" />
						<Skeleton className="h-8 w-full" />
						<Skeleton className="h-8 w-full" />
					</div>
				</CardContent>
			</Card>
		);
	}

	const hasSupplier = supplierPrice.length > 0 && Number(supplierPrice) > 0;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm">Vista previa de precios</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col gap-3">
					{/* Costo row */}
					<PriceRow
						label="Costo"
						price={hasSupplier ? formatCurrency(supplierPrice) : "S/ 0.00"}
						percent="—"
						source={hasSupplier ? "admin-raw" : "no-supplier-price"}
					/>

					{hasSupplier && <div className="border-border border-t" />}

					{/* Cliente row */}
					<PriceRow
						label="Cliente"
						price={
							hasSupplier
								? formatCurrency(result?.customerResult.salePrice.toString() ?? "0")
								: "S/ 0.00"
						}
						percent={hasSupplier ? formatPercent(result?.customerResult.marginPercent ?? 0) : "—"}
						source={
							hasSupplier
								? (result?.customerResult.source ?? "no-supplier-price")
								: "no-supplier-price"
						}
					/>

					{/* Distribuidor row */}
					<PriceRow
						label="Distribuidor"
						price={
							hasSupplier
								? formatCurrency(result?.distributorResult.salePrice.toString() ?? "0")
								: "S/ 0.00"
						}
						percent={
							hasSupplier ? formatPercent(result?.distributorResult.marginPercent ?? 0) : "—"
						}
						source={
							hasSupplier
								? (result?.distributorResult.source ?? "no-supplier-price")
								: "no-supplier-price"
						}
					/>
				</div>
			</CardContent>
		</Card>
	);
}

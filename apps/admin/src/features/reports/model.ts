export const CHANGE_TYPE_OPTIONS = [
	{ label: "Todos", value: "all" },
	{ label: "Precio", value: "price_changed" },
	{ label: "Stock", value: "stock_changed" },
	{ label: "Imagen", value: "image_changed" },
	{ label: "Creado", value: "created" },
	{ label: "Sin stock", value: "out_of_stock" },
] as const;

export const CHANGE_LABELS: Record<
	string,
	{ label: string; variant: "success" | "warning" | "info" | "destructive" }
> = {
	created: { label: "Creado", variant: "success" },
	price_changed: { label: "Precio", variant: "warning" },
	stock_changed: { label: "Stock", variant: "info" },
	image_changed: { label: "Imagen", variant: "info" },
	out_of_stock: { label: "Sin stock", variant: "destructive" },
};

export function formatChangeValue(oldVal: unknown, newVal: unknown): string {
	const fmt = (v: unknown) => {
		if (v === null || v === undefined) return "—";
		if (typeof v === "object") {
			const o = v as Record<string, unknown>;
			if ("price" in o) return `S/ ${o.price}`;
			if ("stock" in o) return String(o.stock);
			if ("hash" in o) return `#${String(o.hash).slice(0, 7)}`;
			if ("detectada" in o) return o.detectada ? "Sí" : "No";
			return JSON.stringify(o);
		}
		return String(v);
	};
	return `${fmt(oldVal)} → ${fmt(newVal)}`;
}

// ── Domain Types ───────────────────────────────────

export interface ReportChange {
	id: string;
	productId: string;
	productName: string;
	productSku: string;
	changeType: string;
	field: string | null;
	oldValue: unknown;
	newValue: unknown;
	reason: string | null;
	createdAt: string;
}

export interface ProductChange {
	id: string;
	syncReportId: string | null;
	reportTrigger: string | null;
	reportStartedAt: string | null;
	changeType: string;
	field: string | null;
	oldValue: unknown;
	newValue: unknown;
	reason: string | null;
	source: string;
	createdAt: string;
}

export interface RecentChange {
	id: string;
	productId: string;
	productName: string;
	productSku: string;
	syncReportId: string | null;
	reportTrigger: string | null;
	reportStartedAt: string | null;
	changeType: string;
	field: string | null;
	oldValue: unknown;
	newValue: unknown;
	reason: string | null;
	source: string;
	createdAt: string;
}

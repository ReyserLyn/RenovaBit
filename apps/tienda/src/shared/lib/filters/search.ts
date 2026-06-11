import { isSortOption, type SortOption } from "./parsers";

const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;

export type CatalogSearch = {
	marcas?: string;
	orden?: SortOption;
	precio_min?: string;
	precio_max?: string;
};

function toStringValue(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function normalizePrice(value: unknown): string | undefined {
	const raw = toStringValue(value)?.trim();
	if (!raw) return undefined;

	return PRICE_PATTERN.test(raw) ? raw : undefined;
}

function normalizeSort(value: unknown): SortOption | undefined {
	const raw = toStringValue(value)?.trim();
	if (!raw) return undefined;
	return isSortOption(raw) ? raw : undefined;
}

function normalizeBrands(value: unknown): string | undefined {
	if (typeof value === "string") {
		const unique = Array.from(
			new Set(
				value
					.split(",")
					.map((item) => item.trim())
					.filter(Boolean),
			),
		);
		return unique.join(",") || undefined;
	}

	if (Array.isArray(value)) {
		const unique = Array.from(
			new Set(value.filter((item): item is string => typeof item === "string")),
		)
			.map((item) => item.trim())
			.filter(Boolean);
		return unique.join(",") || undefined;
	}

	return undefined;
}

export function normalizeCatalogSearch(
	raw: Record<string, unknown>,
	includeBrands: boolean,
): CatalogSearch {
	return {
		marcas: includeBrands ? normalizeBrands(raw.marcas) : undefined,
		orden: normalizeSort(raw.orden),
		precio_min: normalizePrice(raw.precio_min),
		precio_max: normalizePrice(raw.precio_max),
	};
}

export const SORT_VALUES = [
	"relevance",
	"price_asc",
	"price_desc",
	"name_asc",
	"name_desc",
	"newest",
] as const;

export type SortOption = (typeof SORT_VALUES)[number];

export const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
	{ value: "relevance", label: "Relevancia" },
	{ value: "price_asc", label: "Precio: menor a mayor" },
	{ value: "price_desc", label: "Precio: mayor a menor" },
	{ value: "name_asc", label: "Nombre: A-Z" },
	{ value: "name_desc", label: "Nombre: Z-A" },
	{ value: "newest", label: "Más nuevos" },
];

const sortValueSet = new Set(SORT_VALUES);

export function isSortOption(value: string): value is SortOption {
	return sortValueSet.has(value as SortOption);
}

function isSortOptionExceptRelevance(value: string): value is Exclude<SortOption, "relevance"> {
	return value !== "relevance" && sortValueSet.has(value as SortOption);
}

/**
 * Map the UI sort to the API value. "relevance" is the default and is
 * omitted from the API call, so the return type excludes it.
 */
export function mapSortToApi(orden?: string): Exclude<SortOption, "relevance"> | undefined {
	if (!orden) return undefined;
	return isSortOptionExceptRelevance(orden) ? orden : undefined;
}

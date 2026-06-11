import { parseAsArrayOf, parseAsString, parseAsStringLiteral } from "nuqs";

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

const sortValueSet = new Set<string>(SORT_VALUES);

export function isSortOption(value: string): value is SortOption {
	return sortValueSet.has(value);
}

export function mapSortToApi(orden?: string): SortOption | undefined {
	if (!orden || orden === "relevance") return undefined;
	return isSortOption(orden) ? orden : undefined;
}

export const productFilterParsers = {
	orden: parseAsStringLiteral(SORT_VALUES).withDefault("relevance"),
	precio_min: parseAsString.withDefault(""),
	precio_max: parseAsString.withDefault(""),
	marcas: parseAsArrayOf(parseAsString).withDefault([]),
};

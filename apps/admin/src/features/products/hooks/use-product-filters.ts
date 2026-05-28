import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

export const statusOptions = ["all", "active", "inactive"] as const;

export function useProductFilters() {
	const [brandSlug, setBrandSlug] = useQueryState("marca", parseAsString);
	const [categorySlug, setCategorySlug] = useQueryState("categoria", parseAsString);
	const [status, setStatus] = useQueryState(
		"estado",
		parseAsStringLiteral(statusOptions).withDefault("all"),
	);
	const [search, setSearch] = useQueryState("busqueda", parseAsString.withDefault(""));

	return {
		brandSlug,
		setBrandSlug,
		categorySlug,
		setCategorySlug,
		status,
		setStatus,
		search,
		setSearch,
	} as const;
}

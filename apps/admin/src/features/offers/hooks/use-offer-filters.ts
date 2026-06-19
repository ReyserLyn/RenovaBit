import { parseAsInteger, parseAsString, useQueryState } from "nuqs";

export const DEFAULT_PAGE_SIZE = 10;

export function useOfferFilters() {
	const [search, setSearch] = useQueryState("busqueda", parseAsString.withDefault(""));
	const [isActive, setIsActive] = useQueryState("activo", parseAsString.withDefault("all"));
	const [isFeatured, setIsFeatured] = useQueryState("destacado", parseAsString.withDefault("all"));
	const [from, setFrom] = useQueryState("desde", parseAsString);
	const [to, setTo] = useQueryState("hasta", parseAsString);
	const [page, setPage] = useQueryState("pagina", parseAsInteger.withDefault(0));
	const [pageSize, setPageSize] = useQueryState(
		"tamano",
		parseAsInteger.withDefault(DEFAULT_PAGE_SIZE),
	);

	return {
		search,
		setSearch,
		isActive,
		setIsActive,
		isFeatured,
		setIsFeatured,
		from,
		setFrom,
		to,
		setTo,
		page,
		setPage,
		pageSize,
		setPageSize,
	};
}

export type OfferFilters = ReturnType<typeof useOfferFilters>;

import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { isComplaintStatus } from "../model";

export function useComplaintFilters() {
	const [status, setStatus] = useQueryState("estado", parseAsString.withDefault("all"));
	const [search, setSearch] = useQueryState("busqueda", parseAsString.withDefault(""));
	const [page, setPage] = useQueryState("pagina", parseAsInteger.withDefault(0));
	const [pageSize, setPageSize] = useQueryState("limite", parseAsInteger.withDefault(10));

	return {
		status,
		setStatus,
		apiStatus: isComplaintStatus(status) ? status : undefined,
		search,
		setSearch,
		page,
		setPage,
		pageSize,
		setPageSize,
	};
}

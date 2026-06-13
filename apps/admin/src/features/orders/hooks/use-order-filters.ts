import {
	ORDER_STATUS_URL_VALUES,
	type OrderSource,
	type OrderStatus,
	PAYMENT_METHOD_URL_VALUES,
	PAYMENT_URL_TO_API,
	type PaymentMethod,
	STATUS_URL_TO_API,
} from "@renovabit/db/orders";
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";

export const sortFieldValues = [
	"createdAt",
	"total",
	"orderNumber",
	"status",
	"customerName",
] as const;
const sortOrderValues = ["asc", "desc"] as const;

type StatusUrl = (typeof ORDER_STATUS_URL_VALUES)[number];
type PaymentUrl = (typeof PAYMENT_METHOD_URL_VALUES)[number];

function toApiStatus(url: string): OrderStatus | undefined {
	const key = url as StatusUrl;
	return key in STATUS_URL_TO_API ? STATUS_URL_TO_API[key] : undefined;
}

function toApiSource(url: string): OrderSource | undefined {
	return url === "web" || url === "whatsapp" ? url : undefined;
}

function toApiPayment(url: string): PaymentMethod | undefined {
	const key = url as PaymentUrl;
	return key in PAYMENT_URL_TO_API ? PAYMENT_URL_TO_API[key] : undefined;
}

export function useOrderFilters() {
	const [status, setStatus] = useQueryState("estado", parseAsString.withDefault("all"));
	const [source, setSource] = useQueryState("origen", parseAsString.withDefault("all"));
	const [paymentMethod, setPaymentMethod] = useQueryState("pago", parseAsString.withDefault("all"));
	const [from, setFrom] = useQueryState("desde", parseAsString);
	const [to, setTo] = useQueryState("hasta", parseAsString);
	const [search, setSearch] = useQueryState("busqueda", parseAsString.withDefault(""));
	const [sortBy, setSortBy] = useQueryState(
		"orden",
		parseAsStringLiteral(sortFieldValues).withDefault("createdAt"),
	);
	const [sortOrder, setSortOrder] = useQueryState(
		"dir",
		parseAsStringLiteral(sortOrderValues).withDefault("desc"),
	);
	const [page, setPage] = useQueryState("pagina", parseAsInteger.withDefault(0));
	const [pageSize, setPageSize] = useQueryState("limite", parseAsInteger.withDefault(10));

	return {
		status,
		setStatus,
		apiStatus: toApiStatus(status),
		source,
		setSource,
		apiSource: toApiSource(source),
		paymentMethod,
		setPaymentMethod,
		apiPayment: toApiPayment(paymentMethod),
		from,
		setFrom,
		to,
		setTo,
		search,
		setSearch,
		sortBy,
		setSortBy,
		sortOrder,
		setSortOrder,
		page,
		setPage,
		pageSize,
		setPageSize,
	};
}

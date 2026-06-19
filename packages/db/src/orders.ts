// ── Order statuses ───────────────────────────────────

export type OrderStatus = "pending" | "confirmed" | "cancelled" | "refunded";

export const ORDER_STATUS_TUPLE: [OrderStatus, ...OrderStatus[]] = [
	"pending",
	"confirmed",
	"cancelled",
	"refunded",
];

export const ORDER_STATUSES: OrderStatus[] = ORDER_STATUS_TUPLE;

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
	pending: ["confirmed", "cancelled"],
	confirmed: ["cancelled", "refunded"],
	cancelled: [],
	refunded: [],
};

// ── Payment methods ──────────────────────────────────

export type PaymentMethod = "cash" | "transfer" | "yape" | "plin";

export const PAYMENT_METHOD_TUPLE: [PaymentMethod, ...PaymentMethod[]] = [
	"cash",
	"transfer",
	"yape",
	"plin",
];

export const PAYMENT_METHODS: PaymentMethod[] = PAYMENT_METHOD_TUPLE;

// ── Order sources ────────────────────────────────────

export type OrderSource = "web" | "whatsapp";

export const ORDER_SOURCE_TUPLE: [OrderSource, ...OrderSource[]] = ["web", "whatsapp"];

export const ORDER_SOURCES: OrderSource[] = ORDER_SOURCE_TUPLE;

// ── Stock reservation ────────────────────────────────

/** Pedidos que reservan stock físico hasta ser confirmados. */
export const ORDER_RESERVATION_STATUSES: OrderStatus[] = ["pending"];

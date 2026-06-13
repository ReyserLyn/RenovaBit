import { ORDER_SOURCES, ORDER_STATUSES, PAYMENT_METHODS } from "@renovabit/db/orders";
import { t, type UnwrapSchema } from "elysia";

// ── Shared literal unions ──────────────────────
// Valores duplicados intencionalmente aquí porque TypeBox necesita
// una tupla de literales; el SSoT de transiciones/labels vive en @renovabit/db/orders.

const OrderStatusSchema = t.Union([
	t.Literal("pending"),
	t.Literal("confirmed"),
	t.Literal("cancelled"),
	t.Literal("refunded"),
]);

const OrderSourceSchema = t.Union([t.Literal("web"), t.Literal("whatsapp")]);

const PaymentMethodSchema = t.Union([
	t.Literal("cash"),
	t.Literal("transfer"),
	t.Literal("yape"),
	t.Literal("plin"),
]);

// ── Responses ────────────────────────────────

const OrderItemResponse = t.Object({
	id: t.String({ format: "uuid" }),
	productId: t.Nullable(t.String({ format: "uuid" })),
	productName: t.String(),
	productSku: t.String(),
	quantity: t.Integer({ minimum: 1 }),
	unitPrice: t.String(),
	finalPrice: t.String(),
});

const OrderResponse = t.Object({
	id: t.String({ format: "uuid" }),
	userId: t.Nullable(t.String({ format: "uuid" })),
	orderNumber: t.String(),
	status: OrderStatusSchema,
	source: OrderSourceSchema,
	paymentMethod: t.Nullable(PaymentMethodSchema),
	paymentProofUrl: t.Nullable(t.String()), // reserved for future payment proof uploads; currently unpopulated by service

	customerName: t.Nullable(t.String()),
	customerPhone: t.Nullable(t.String()),
	customerEmail: t.Nullable(t.String()),

	subtotal: t.String(),
	discountTotal: t.String(),
	total: t.String(),

	notes: t.Nullable(t.String()),
	adminNotes: t.Nullable(t.String()),

	items: t.Array(OrderItemResponse),

	createdAt: t.String(),
	confirmedAt: t.Nullable(t.String()),
	cancelledAt: t.Nullable(t.String()),
	cancelReason: t.Nullable(t.String()),
});

const OrderListItem = t.Object({
	id: t.String({ format: "uuid" }),
	orderNumber: t.String(),
	status: OrderStatusSchema,
	source: OrderSourceSchema,
	total: t.String(),
	itemsCount: t.Integer({ minimum: 0 }),
	customerName: t.Nullable(t.String()),
	createdAt: t.String(),
});

const OrderListResponse = t.Object({
	orders: t.Array(OrderListItem),
	total: t.Integer({ minimum: 0 }),
});

// ── Bodies ───────────────────────────────────

const CreateOrderBody = t.Object({
	cartId: t.String({ format: "uuid" }),
	guestToken: t.Optional(t.String({ minLength: 1 })),
	customerName: t.Optional(t.Nullable(t.String({ minLength: 1, maxLength: 255 }))),
	customerPhone: t.Optional(t.Nullable(t.String({ minLength: 1, maxLength: 20 }))),
	notes: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))),
	paymentMethod: t.Optional(t.Nullable(PaymentMethodSchema)),
});

const AdminUpdateOrderBody = t.Object({
	status: OrderStatusSchema,
	adminNotes: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))),
	cancelReason: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
});

// ── Params ───────────────────────────────────

const IdParams = t.Object({
	id: t.String({ format: "uuid" }),
});

// ── Query ────────────────────────────────────

const OrdersListQuery = t.Object({
	page: t.Optional(t.String()),
	limit: t.Optional(t.String()),
	status: t.Optional(
		t.Union([
			t.Literal("pending"),
			t.Literal("confirmed"),
			t.Literal("cancelled"),
			t.Literal("refunded"),
		]),
	),
});

const AdminOrdersListQuery = t.Object({
	status: t.Optional(
		t.Union([
			t.Literal("pending"),
			t.Literal("confirmed"),
			t.Literal("cancelled"),
			t.Literal("refunded"),
		]),
	),
	page: t.Optional(t.String()),
	limit: t.Optional(t.String()),
	search: t.Optional(t.String({ minLength: 1 })),
});

// ── Batch ────────────────────────────────────

const BatchActionBody = t.Object({
	ids: t.Array(t.String({ format: "uuid" }), { minItems: 1, maxItems: 50 }),
	action: t.Union([t.Literal("confirmed"), t.Literal("cancelled"), t.Literal("refunded")]),
});

const BatchActionResult = t.Object({
	succeeded: t.Array(t.String()),
	failed: t.Array(
		t.Object({
			id: t.String(),
			reason: t.String(),
		}),
	),
});

// ── Error ─────────────────────────────────────

export const ErrorResponse = t.Object({
	errId: t.String(),
	code: t.String(),
	message: t.String(),
	statusCode: t.Number(),
});

// ── Export ────────────────────────────────────

type OrderModelShape = {
	createBody: typeof CreateOrderBody;
	adminUpdateBody: typeof AdminUpdateOrderBody;
	batchActionBody: typeof BatchActionBody;
	idParams: typeof IdParams;
	listQuery: typeof OrdersListQuery;
	adminListQuery: typeof AdminOrdersListQuery;
	orderResponse: typeof OrderResponse;
	orderListItem: typeof OrderListItem;
	orderListResponse: typeof OrderListResponse;
	batchActionResult: typeof BatchActionResult;
};

export const OrderModel: OrderModelShape = {
	// Bodies
	createBody: CreateOrderBody,
	adminUpdateBody: AdminUpdateOrderBody,
	batchActionBody: BatchActionBody,

	// Params
	idParams: IdParams,

	// Query
	listQuery: OrdersListQuery,
	adminListQuery: AdminOrdersListQuery,

	// Responses
	orderResponse: OrderResponse,
	orderListItem: OrderListItem,
	orderListResponse: OrderListResponse,
	batchActionResult: BatchActionResult,
};

export type OrderModel = {
	[k in keyof OrderModelShape]: UnwrapSchema<OrderModelShape[k]>;
};

export type OrderResponse = typeof OrderResponse.static;
export type OrderListItem = typeof OrderListItem.static;

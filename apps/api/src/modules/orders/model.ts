import { t, type UnwrapSchema } from "elysia";

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
	status: t.String(),
	source: t.String(),
	paymentMethod: t.Nullable(t.String()),
	paymentProofUrl: t.Nullable(t.String()),

	customerName: t.Nullable(t.String()),
	customerPhone: t.Nullable(t.String()),

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
	status: t.String(),
	source: t.String(),
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
	paymentMethod: t.Optional(
		t.Nullable(
			t.Union([
				t.Literal("cash"),
				t.Literal("transfer"),
				t.Literal("deposit"),
				t.Literal("yape"),
				t.Literal("plin"),
				t.Literal("culqi"),
			]),
		),
	),
});

const AdminUpdateOrderBody = t.Object({
	status: t.Union([t.Literal("confirmed"), t.Literal("cancelled"), t.Literal("refunded")]),
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
});

// ── Error ─────────────────────────────────────

export const ErrorResponse = t.Object({
	errId: t.String(),
	code: t.String(),
	message: t.String(),
	statusCode: t.Number(),
});

// ── Export ────────────────────────────────────

export const OrderModel = {
	// Bodies
	createBody: CreateOrderBody,
	adminUpdateBody: AdminUpdateOrderBody,

	// Params
	idParams: IdParams,

	// Query
	listQuery: OrdersListQuery,
	adminListQuery: AdminOrdersListQuery,

	// Responses
	orderResponse: OrderResponse,
	orderListItem: OrderListItem,
	orderListResponse: OrderListResponse,
} as const;

export type OrderModel = {
	[k in keyof typeof OrderModel]: UnwrapSchema<(typeof OrderModel)[k]>;
};

export type OrderResponse = typeof OrderResponse.static;
export type OrderListItem = typeof OrderListItem.static;

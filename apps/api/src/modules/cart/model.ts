import { t, type UnwrapSchema } from "elysia";

// ── Responses ────────────────────────────────

const CartItemProduct = t.Object({
	id: t.String({ format: "uuid" }),
	name: t.String(),
	slug: t.String(),
});

const CartItemResponse = t.Object({
	id: t.String({ format: "uuid" }),
	productId: t.String({ format: "uuid" }),
	productName: t.String(),
	productSlug: t.String(),
	productSku: t.String(),
	quantity: t.Integer({ minimum: 0 }),
	addedAtPrice: t.String(),
	currentPrice: t.Nullable(t.String()),
	status: t.String(),
	statusMessage: t.Nullable(t.String()),
	primaryImage: t.Nullable(
		t.Object({
			url: t.String(),
			alt: t.Nullable(t.String()),
		}),
	),
	product: t.Nullable(CartItemProduct),
});

const CartResponse = t.Object({
	id: t.String({ format: "uuid" }),
	guestToken: t.Nullable(t.String()),
	items: t.Array(CartItemResponse),
	itemsCount: t.Integer({ minimum: 0 }),
	subtotal: t.String(),
	lastActivityAt: t.String(),
});

const CartTotalResponse = t.Object({
	itemsCount: t.Integer({ minimum: 0 }),
	subtotal: t.String(),
});

// ── Bodies ───────────────────────────────────

const AddToCartBody = t.Object({
	productId: t.String({ format: "uuid" }),
	quantity: t.Optional(t.Integer({ minimum: 1, default: 1 })),
});

const UpdateCartItemBody = t.Object({
	quantity: t.Integer({ minimum: 0 }),
});

const MergeCartBody = t.Object({
	guestToken: t.String({ minLength: 1 }),
});

// ── Params ───────────────────────────────────

const ItemIdParams = t.Object({
	id: t.String({ format: "uuid" }),
});

// ── Query ────────────────────────────────────

const CartQuery = t.Object({
	guestToken: t.Optional(t.String({ minLength: 1 })),
});

// ── Error ─────────────────────────────────────

export const ErrorResponse = t.Object({
	errId: t.String(),
	code: t.String(),
	message: t.String(),
	statusCode: t.Number(),
});

// ── Export ────────────────────────────────────

export const CartModel = {
	// Bodies
	addToCartBody: AddToCartBody,
	updateCartItemBody: UpdateCartItemBody,
	mergeCartBody: MergeCartBody,

	// Params
	itemIdParams: ItemIdParams,

	// Query
	cartQuery: CartQuery,

	// Responses
	cartResponse: CartResponse,
	cartItemResponse: CartItemResponse,
	cartTotalResponse: CartTotalResponse,
} as const;

export type CartModel = {
	[k in keyof typeof CartModel]: UnwrapSchema<(typeof CartModel)[k]>;
};

export type CartResponse = typeof CartResponse.static;
export type CartItemResponse = typeof CartItemResponse.static;
export type CartTotalResponse = typeof CartTotalResponse.static;

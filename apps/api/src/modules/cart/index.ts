import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { Elysia, t } from "elysia";
import { auth } from "@/utils/auth/auth";
import { getUserRole } from "@/utils/auth/helpers";
import { CartModel, ErrorResponse } from "./model";
import { CartService } from "./service";

async function resolveCartOwner(request: Request): Promise<{ userId: string | null }> {
	const session = await auth.api.getSession({ headers: request.headers });
	return { userId: session?.user.id ?? null };
}

function getGuestToken(query: { guestToken?: string }): string | null {
	return query.guestToken ?? null;
}

// ═══════════════════════════════════════════════════
//  Prefijo: /api/v1/cart
// ═══════════════════════════════════════════════════

export const cartRoute = new Elysia({ prefix: "/cart" })
	// ── Get or Create Cart ──────────────────────
	.get(
		"/",
		async ({ query, request, set }) => {
			const { userId } = await resolveCartOwner(request);
			const guestToken = getGuestToken(query);
			const role = await getUserRole(request);
			const cart = await CartService.getOrCreate(userId, guestToken, role);

			if (cart.guestToken) {
				set.headers["x-guest-token"] = cart.guestToken;
			}

			return cart;
		},
		{
			query: CartModel.cartQuery,
			response: { 200: CartModel.cartResponse, 400: ErrorResponse },
			detail: { summary: "Obtener o crear carrito", tags: ["Cart"] },
		},
	)

	// ── Get Cart Total (lightweight) ────────────
	.get(
		"/total",
		async ({ query, request }) => {
			const { userId } = await resolveCartOwner(request);
			const guestToken = getGuestToken(query);
			const role = await getUserRole(request);
			return CartService.getTotalByOwner(userId, guestToken, role);
		},
		{
			query: CartModel.cartQuery,
			response: { 200: CartModel.cartTotalResponse },
			detail: { summary: "Total del carrito (items + subtotal)", tags: ["Cart"] },
		},
	)

	// ── Add Item ────────────────────────────────
	.post(
		"/items",
		async ({ body, query, request }) => {
			const { userId } = await resolveCartOwner(request);
			const guestToken = getGuestToken(query);
			const role = await getUserRole(request);
			const cart = await CartService.getOrCreate(userId, guestToken, role);
			return CartService.addItem(cart.id, body, role);
		},
		{
			query: CartModel.cartQuery,
			body: CartModel.addToCartBody,
			response: {
				200: CartModel.cartResponse,
				400: ErrorResponse,
				404: ErrorResponse,
				422: ErrorResponse,
			},
			detail: { summary: "Añadir producto al carrito", tags: ["Cart"] },
		},
	)

	// ── Update Item Quantity ────────────────────
	.patch(
		"/items/:id",
		async ({ params: { id }, body, query, request }) => {
			const { userId } = await resolveCartOwner(request);
			const guestToken = getGuestToken(query);
			const role = await getUserRole(request);
			const cart = await CartService.requireCart(userId, guestToken, role);
			return CartService.updateQuantity(cart.id, id, body, role);
		},
		{
			query: CartModel.cartQuery,
			params: CartModel.itemIdParams,
			body: CartModel.updateCartItemBody,
			response: { 200: CartModel.cartResponse, 400: ErrorResponse, 404: ErrorResponse },
			detail: { summary: "Actualizar cantidad de un item", tags: ["Cart"] },
		},
	)

	// ── Remove Item ─────────────────────────────
	.delete(
		"/items/:id",
		async ({ params: { id }, query, request }) => {
			const { userId } = await resolveCartOwner(request);
			const guestToken = getGuestToken(query);
			const role = await getUserRole(request);
			const cart = await CartService.requireCart(userId, guestToken, role);
			return CartService.removeItem(cart.id, id, role);
		},
		{
			query: CartModel.cartQuery,
			params: CartModel.itemIdParams,
			response: { 200: CartModel.cartResponse, 404: ErrorResponse },
			detail: { summary: "Eliminar item del carrito", tags: ["Cart"] },
		},
	)

	// ── Clear Cart ──────────────────────────────
	.delete(
		"/",
		async ({ query, request, set }) => {
			const { userId } = await resolveCartOwner(request);
			const guestToken = getGuestToken(query);
			const role = await getUserRole(request);
			const cart = await CartService.requireCart(userId, guestToken, role);
			await CartService.clearCart(cart.id);
			set.status = 204;
		},
		{
			query: CartModel.cartQuery,
			response: { 204: t.Undefined() },
			detail: { summary: "Vaciar carrito", tags: ["Cart"] },
		},
	)

	// ── Merge Guest Cart into User Cart ─────────
	.post(
		"/merge",
		async ({ body, request }) => {
			const session = await auth.api.getSession({ headers: request.headers });
			if (!session) {
				throw createApiError({
					code: BackendErrorCodes.INVALID_CREDENTIALS,
					message: "Inicia sesión para fusionar tu carrito",
					logLevel: "info",
					doNotLog: true,
				});
			}
			const role = await getUserRole(request);
			return CartService.merge(session.user.id, body.guestToken, role);
		},
		{
			body: CartModel.mergeCartBody,
			response: { 200: CartModel.cartResponse, 401: ErrorResponse, 404: ErrorResponse },
			detail: { summary: "Fusionar carrito invitado al del usuario", tags: ["Cart"] },
		},
	);

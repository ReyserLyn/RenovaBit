import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import type { CartResponse, CartTotalResponse } from "./queries";

export const getCartServerFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<CartResponse | null> => {
		try {
			const apiUrl = process.env.VITE_API_URL ?? "http://localhost:3001";
			const headers = getRequestHeaders();

			const response = await fetch(`${apiUrl}/api/v1/cart/`, {
				headers: { cookie: headers.get?.("cookie") ?? "" },
			});

			if (!response.ok) return null;
			return (await response.json()) as CartResponse;
		} catch {
			return null;
		}
	},
);

export const getCartTotalServerFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<CartTotalResponse | null> => {
		try {
			const apiUrl = process.env.VITE_API_URL ?? "http://localhost:3001";
			const headers = getRequestHeaders();

			const response = await fetch(`${apiUrl}/api/v1/cart/total`, {
				headers: { cookie: headers.get?.("cookie") ?? "" },
			});

			if (!response.ok) return null;
			return (await response.json()) as CartTotalResponse;
		} catch {
			return null;
		}
	},
);

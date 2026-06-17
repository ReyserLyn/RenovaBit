import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { api } from "@/shared/lib/api/api-client";

export const getCartServerFn = createServerFn({ method: "GET" }).handler(async () => {
	try {
		const reqHeaders = getRequestHeaders();
		const cookie = reqHeaders.get("cookie") ?? "";

		const { data, error } = await api.api.v1.cart.get({
			headers: { cookie },
		});

		if (error || !data) return null;
		return data;
	} catch {
		return null;
	}
});

export const getCartTotalServerFn = createServerFn({ method: "GET" }).handler(async () => {
	try {
		const reqHeaders = getRequestHeaders();
		const cookie = reqHeaders.get("cookie") ?? "";

		const { data, error } = await api.api.v1.cart.total.get({
			headers: { cookie },
		});

		if (error || !data) return null;
		return data;
	} catch {
		return null;
	}
});

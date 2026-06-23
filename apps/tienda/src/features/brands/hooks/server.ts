import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { api } from "@/shared/lib/api/api-client";

export const getBrandListServerFn = createServerFn({ method: "GET" }).handler(async () => {
	try {
		const reqHeaders = getRequestHeaders();
		const cookie = reqHeaders.get("cookie") ?? "";

		const { data, error } = await api.api.v1.brands.get({
			headers: { cookie },
		});

		if (error || !data) return null;
		return data;
	} catch {
		return null;
	}
});

export const getBrandByCategorySlugServerFn = createServerFn({ method: "GET" })
	.validator((input: { categorySlug: string }) => input)
	.handler(async ({ data: { categorySlug } }) => {
		try {
			const reqHeaders = getRequestHeaders();
			const cookie = reqHeaders.get("cookie") ?? "";

			const { data, error } = await api.api.v1.brands.get({
				headers: { cookie },
				query: { categorySlug },
			});

			if (error || !data) return null;
			return data;
		} catch {
			return null;
		}
	});

export const getBrandBySearchTermServerFn = createServerFn({ method: "GET" })
	.validator((input: { q: string; categorySlug?: string }) => input)
	.handler(async ({ data: { q, categorySlug } }) => {
		try {
			const reqHeaders = getRequestHeaders();
			const cookie = reqHeaders.get("cookie") ?? "";

			const { data, error } = await api.api.v1.brands.get({
				headers: { cookie },
				query: { q, ...(categorySlug ? { categorySlug } : {}) },
			});

			if (error || !data) return null;
			return data;
		} catch {
			return null;
		}
	});

export const getBrandBySlugServerFn = createServerFn({ method: "GET" })
	.validator((input: { slug: string }) => input)
	.handler(async ({ data: { slug } }) => {
		try {
			const reqHeaders = getRequestHeaders();
			const cookie = reqHeaders.get("cookie") ?? "";

			const { data, error } = await api.api.v1.brands({ slug }).get({
				headers: { cookie },
			});

			if (error || !data) return null;
			return data;
		} catch {
			return null;
		}
	});

import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { api } from "@/shared/lib/api/api-client";

/** Recursive category tree node matching API shape. */
export interface CategoryTreeItem {
	id: string;
	name: string;
	slug: string;
	imageUrl: string | null;
	description: string | null;
	productCount: number;
	children: CategoryTreeItem[];
}

export const getCategoryTreeServerFn = createServerFn({ method: "GET" }).handler(async () => {
	try {
		const reqHeaders = getRequestHeaders();
		const cookie = reqHeaders.get("cookie") ?? "";

		const { data, error } = await api.api.v1.categories.get({
			headers: { cookie },
		});

		if (error || !data) return null;
		return data as CategoryTreeItem[];
	} catch {
		return null;
	}
});

export const getCategoryBySlugServerFn = createServerFn({ method: "GET" })
	.validator((input: { slug: string }) => input)
	.handler(async ({ data: { slug } }) => {
		try {
			const reqHeaders = getRequestHeaders();
			const cookie = reqHeaders.get("cookie") ?? "";

			const { data, error } = await api.api.v1.categories({ slug }).get({
				headers: { cookie },
			});

			if (error || !data) return null;
			return data;
		} catch {
			return null;
		}
	});

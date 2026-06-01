import { queryOptions, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/lib/api/api-client";
import { unwrapResponse } from "@/shared/lib/api/api-errors";
import type { ProductChange } from "../service/reports.service";

export const productChangeKeys = {
	byProduct: (productId: string) => ["product-changes", productId] as const,
};

export const productChangesQueryOptions = (productId: string) =>
	queryOptions({
		queryKey: productChangeKeys.byProduct(productId),
		queryFn: async () => {
			const data = await unwrapResponse<{ changes: ProductChange[]; total: number }>(
				api.api.v1.products({ id: productId }).changes.get(),
			);
			return data.changes;
		},
		enabled: productId.length > 0,
	});

export function useProductChanges(productId: string) {
	return useQuery(productChangesQueryOptions(productId));
}

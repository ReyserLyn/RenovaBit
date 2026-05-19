import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const queryClientDefaultOptions = {
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60 * 5,
			gcTime: 1000 * 60 * 30,
			retry: 1,
			refetchOnWindowFocus: import.meta.env.PROD,
			refetchOnReconnect: true,
		},
		mutations: {
			retry: 0,
		},
	},
} as const;

function createQueryClient(): QueryClient {
	return new QueryClient(queryClientDefaultOptions);
}

/** En cliente: una sola instancia para toda la SPA. En SSR: una por petición (evita filtrar sesión entre usuarios). */
let queryClientSingleton: QueryClient | undefined;

export function getContext(): { queryClient: QueryClient } {
	if (import.meta.env.SSR) {
		return { queryClient: createQueryClient() };
	}
	if (!queryClientSingleton) {
		queryClientSingleton = createQueryClient();
	}
	return { queryClient: queryClientSingleton };
}

export default function TanStackQueryProvider({
	children,
	queryClient,
}: {
	children: ReactNode;
	queryClient?: QueryClient;
}) {
	const client = queryClient ?? getContext().queryClient;

	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

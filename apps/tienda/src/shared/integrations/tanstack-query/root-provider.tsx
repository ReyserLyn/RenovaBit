import { QueryClient } from "@tanstack/react-query";

const queryClientDefaultOptions = {
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60 * 5,
			gcTime: 1000 * 60 * 30,
			retry: 1,
			refetchOnWindowFocus: false,
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

/**
 * Client side: one instance for the whole SPA. Server: one per request (avoids leaking session
 * between users). `setupRouterSsrQueryIntegration` mounts this same instance around the app, so
 * router loaders and React components share a single client per SSR request.
 */
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

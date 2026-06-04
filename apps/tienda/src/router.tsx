import type { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { DefaultCatchBoundary } from "@/shared/components/error/DefaultCatchBoundary";
import { NotFound } from "@/shared/components/error/NotFound";

import { routeTree } from "./routeTree.gen";
import { getContext } from "./shared/integrations/tanstack-query/root-provider";

export interface MyRouterContext {
	queryClient: QueryClient;
}

export function getRouter() {
	const { queryClient } = getContext();

	const router = createTanStackRouter({
		routeTree,
		context: { queryClient },

		// Restaurar scroll al navegar
		scrollRestoration: true,

		// Precargar rutas al hacer hover/intent
		defaultPreload: "intent",

		// Siempre revalidar al precargar (delegamos a TanStack Query)
		defaultPreloadStaleTime: 0,

		// Compartir estructura de datos entre renders
		defaultStructuralSharing: true,

		defaultErrorComponent: DefaultCatchBoundary,
		defaultNotFoundComponent: NotFound,
	});

	setupRouterSsrQueryIntegration({
		router,
		queryClient,
		wrapQueryClient: false,
	});

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}

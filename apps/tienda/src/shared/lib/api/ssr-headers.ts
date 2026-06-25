/**
 * SSR request headers for the Eden Treaty client.
 *
 * - In the browser, `fetch` already sends cookies via `credentials: "include"`
 *   (configured in `api-client.ts`), so this returns an empty object.
 * - In SSR (loaders, server fns), the browser cookie isn't automatically
 *   forwarded to the API. Without it, `getUserRole` on the backend defaults
 *   to `"customer"`, which leaks customer pricing to authenticated admin /
 *   distributor sessions. We read the inbound `cookie` header and surface
 *   it as an Eden-compatible `headers` object.
 *
 * Uses `createIsomorphicFn` so the `@tanstack/react-start/server` import
 * is tree-shaken from the client bundle by the TanStack Start compiler.
 */
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

export const getApiSsrHeaders: () => Record<string, string> = createIsomorphicFn()
	.server((): Record<string, string> => {
		const headers = getRequestHeaders();
		const cookie = headers.get("cookie") ?? "";
		return cookie ? { cookie } : {};
	})
	.client((): Record<string, string> => ({}));

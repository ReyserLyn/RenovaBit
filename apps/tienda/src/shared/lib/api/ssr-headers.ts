/**
 * SSR request headers for the Eden Treaty client.
 *
 * In the browser, `fetch` already sends cookies via `credentials: "include"`
 * (configured in `api-client.ts`), so this returns an empty object.
 *
 * In SSR (loaders, server fns), the browser cookie isn't automatically
 * forwarded to the API. Without it, `getUserRole` on the backend defaults
 * to `"customer"`, which leaks customer pricing to authenticated admin /
 * distributor sessions. This helper reads the inbound `cookie` header via
 * `@tanstack/react-start/server` and surfaces it as an Eden-compatible
 * `headers` object. Safe to call from code that also runs in the browser
 * (queries used by both loaders and `useQuery`).
 */
export async function getApiSsrHeaders(): Promise<Record<string, string>> {
	if (typeof window !== "undefined") return {};
	const mod = await import("@tanstack/react-start/server");
	const headers = mod.getRequestHeaders();
	const cookie = headers.get("cookie") ?? "";
	return cookie ? { cookie } : {};
}

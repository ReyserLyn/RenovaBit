/**
 * IP resolution and skip logic for rate limiting tiers.
 *
 * IP priority:
 *   1. `cf-connecting-ip` — ONLY when `TRUST_CF_CONNECTING_IP=true`. Cloudflare
 *      overwrites this header at the edge, but without Cloudflare in front it
 *      is client-controlled and therefore spoofable; ignored by default.
 *   2. Rightmost `x-forwarded-for` entry — the hop our edge proxy (Traefik)
 *      appends. Traefik discards client-supplied chains from untrusted peers,
 *      so the rightmost entry is the real client; the leftmost is spoofable.
 *   3. Socket remote address (`server.requestIP`) — direct connections with no
 *      proxy in between (local dev, internal callers).
 *   4. "anonymous".
 */

/** Structural subset of Bun's server needed for the socket-address fallback. */
export type RequestIpServer =
	| { requestIP?: (request: Request) => { address?: string } | null }
	| null
	| undefined;

const TRUST_CF_HEADER_ENV = "TRUST_CF_CONNECTING_IP";

/**
 * Resolve the client IP from a request.
 * Priority: trusted cf-connecting-ip → rightmost x-forwarded-for → socket
 * remote address → "anonymous".
 */
export function resolveClientKey(request: Request, server?: RequestIpServer): string {
	// Opt-in only: trusting cf-connecting-ip without Cloudflare lets a direct
	// client rotate the header and get unlimited fresh counters.
	if (process.env[TRUST_CF_HEADER_ENV] === "true") {
		const cfIp = request.headers.get("cf-connecting-ip");
		if (cfIp) return cfIp;
	}

	const forwardedFor = request.headers.get("x-forwarded-for");
	if (forwardedFor) {
		// Rightmost entry: appended by the closest trusted proxy. The leftmost
		// entry is attacker-controlled when any upstream forwarded it verbatim.
		const chain = forwardedFor
			.split(",")
			.map((entry) => entry.trim())
			.filter(Boolean);
		const rightmost = chain[chain.length - 1];
		if (rightmost) return rightmost;
	}

	const socketIp = server?.requestIP?.(request)?.address;
	if (socketIp) return socketIp;

	return "anonymous";
}

function getPathname(request: Request): string {
	try {
		return new URL(request.url).pathname;
	} catch {
		return "";
	}
}

/**
 * Base skip: paths and conditions that should NEVER be rate-limited
 * by any tier.
 */
export function skipRateLimit(request: Request): boolean {
	const pathname = getPathname(request);

	if (
		pathname === "/health" ||
		pathname === "/favicon.ico" ||
		pathname === "/" ||
		pathname.startsWith("/docs") ||
		pathname.startsWith("/api/v1/auth")
	) {
		return true;
	}

	// Skip WebSocket upgrade requests
	const upgrade = request.headers.get("upgrade");
	if (upgrade?.toLowerCase() === "websocket") {
		return true;
	}

	return false;
}

/**
 * Skip for the global-ip tier: identical to the base skip.
 */
export const skipGlobalIp = skipRateLimit;

/**
 * Skip for the user-strict tier: applies to write-heavy cart
 * (POST/PATCH/DELETE), orders (POST) and complaints (POST) endpoints.
 */
export function skipUserStrict(request: Request): boolean {
	if (skipRateLimit(request)) return true;

	const pathname = getPathname(request);
	const method = request.method;

	// Admin has its own stricter tier — don't double-count
	if (pathname.startsWith("/api/v1/admin")) {
		return true;
	}

	// Only rate-limit cart writes, order creation and complaints registration.
	// Complaints share this tier (and the `user-strict:<ip>` Redis key) instead
	// of mounting their own rate-limit plugin: a scoped plugin's onError hook
	// shadows the global error handler for sibling routes registered after it.
	const isCartWrite =
		pathname.startsWith("/api/v1/cart") &&
		(method === "POST" || method === "PATCH" || method === "DELETE");
	const isOrdersPost = pathname.startsWith("/api/v1/orders") && method === "POST";
	const isComplaintsPost = pathname.startsWith("/api/v1/complaints") && method === "POST";

	if (!isCartWrite && !isOrdersPost && !isComplaintsPost) {
		return true;
	}

	return false;
}

/**
 * Skip for the admin-strict tier: only applies to /api/v1/admin/* routes.
 */
export function skipAdminStrict(request: Request): boolean {
	if (skipRateLimit(request)) return true;

	const pathname = getPathname(request);

	if (!pathname.startsWith("/api/v1/admin")) {
		return true;
	}

	return false;
}

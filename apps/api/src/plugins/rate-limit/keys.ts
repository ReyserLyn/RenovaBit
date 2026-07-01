/**
 * IP resolution and skip logic for rate limiting tiers.
 *
 * IP priority: cf-connecting-ip → first IP in x-forwarded-for → "anonymous"
 */

/**
 * Resolve the client IP from a request.
 * Priority: cf-connecting-ip header → first IP in x-forwarded-for header → "anonymous"
 */
export function resolveClientKey(request: Request): string {
	const cfIp = request.headers.get("cf-connecting-ip");
	if (cfIp) return cfIp;

	const forwardedFor = request.headers.get("x-forwarded-for");
	if (forwardedFor) {
		const firstIp = forwardedFor.split(",")[0]?.trim();
		if (firstIp) return firstIp;
	}

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
 * Skip for the user-strict tier: only applies to write-heavy
 * cart (POST/PATCH/DELETE) and orders (POST) endpoints.
 */
export function skipUserStrict(request: Request): boolean {
	if (skipRateLimit(request)) return true;

	const pathname = getPathname(request);
	const method = request.method;

	// Admin has its own stricter tier — don't double-count
	if (pathname.startsWith("/api/v1/admin")) {
		return true;
	}

	// Only rate-limit cart writes and order creation
	const isCartWrite =
		pathname.startsWith("/api/v1/cart") &&
		(method === "POST" || method === "PATCH" || method === "DELETE");
	const isOrdersPost = pathname.startsWith("/api/v1/orders") && method === "POST";

	if (!isCartWrite && !isOrdersPost) {
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

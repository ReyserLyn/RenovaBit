import { AsyncLocalStorage } from "node:async_hooks";
import { elysiaLogLayer } from "@loglayer/elysia";
import { Elysia } from "elysia";
import { nanoid } from "nanoid";
import { logger } from "../utils/logger";

/** WeakMap para asociar reqId a cada Request sin contaminar el objeto. */
const reqIdByRequest = new WeakMap<Request, string>();

/**
 * Almacén local asíncrono que propaga el reqId a través de la cadena de
 * llamadas (DB, R2, Redis, AI) sin pasarlo explícitamente.
 *
 * Uso desde cualquier lugar:
 *   const reqId = requestIdStorage.getStore()?.reqId;
 */
export const requestIdStorage = new AsyncLocalStorage<{ reqId: string }>();

/**
 * Redacta información sensible del user-agent: elimina la versión del
 * navegador/SO pero conserva la familia (Chrome, Firefox, etc.) y el
 * SO base.
 *
 * Ej: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ..."
 *   → "Windows Chrome"
 *
 * Ej: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ..."
 *   → "iOS Safari"
 */
function redactUserAgent(ua: string | null): string | undefined {
	if (!ua) return undefined;

	const osMatch = ua.match(/\(([^;]+)/);
	const os = osMatch?.[1]?.trim() ?? "Unknown";

	let browser = "Unknown";
	if (ua.includes("Chrome/") && !ua.includes("Edg/")) browser = "Chrome";
	else if (ua.includes("Firefox/")) browser = "Firefox";
	else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari";
	else if (ua.includes("Edg/")) browser = "Edge";

	return `${os} ${browser}`;
}

const logLayerPlugin = elysiaLogLayer({
	instance: logger,
	requestId: () => nanoid(12),
	autoLogging: {
		ignore: [],
	},
	contextFn: ({ request }) => ({
		reqId: requestIdStorage.getStore()?.reqId ?? reqIdByRequest.get(request),
		ua: redactUserAgent(request.headers.get("user-agent")),
	}),
});

export const LoggerPlugin = new Elysia({ name: "logger" })
	.use(logLayerPlugin)
	// Propaga el reqId via WeakMap + AsyncLocalStorage.
	// 1. Generamos reqId con nanoid (independiente del que genera elysiaLogLayer)
	// 2. Lo almacenamos en WeakMap<Request> para acceso determinista
	// 3. Lo propagamos via AsyncLocalStorage.enterWith() para que handlers,
	//    servicios y llamadas a DB/R2/Redis/AI hereden el reqId automáticamente.
	.onBeforeHandle(({ request }) => {
		const reqId = nanoid(12);
		reqIdByRequest.set(request, reqId);
		requestIdStorage.enterWith({ reqId });
	});

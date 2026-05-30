/**
 * URL base de la API.
 *
 * Se configura con VITE_API_URL en .env / .env.production.
 * En desarrollo usa http://localhost:3001 por defecto.
 *
 * ⚠️  En cliente usa import.meta.env (reemplazo estático de Vite).
 *     En SSR usa process.env como fallback.
 */
export function getApiBaseUrl(): string {
	return import.meta.env.VITE_API_URL ?? process.env.VITE_API_URL ?? "http://localhost:3001";
}

/**
 * Convierte la URL HTTP de la API a WebSocket (ws:// o wss://).
 * Ejemplo: https://api.renovabit.com → wss://api.renovabit.com
 */
export function getWsUrl(path = "/api/v1/ws"): string {
	const apiUrl = getApiBaseUrl();
	const wsProtocol = apiUrl.startsWith("https") ? "wss" : "ws";
	const host = apiUrl.replace(/^https?:\/\//, "");
	return `${wsProtocol}://${host}${path}`;
}

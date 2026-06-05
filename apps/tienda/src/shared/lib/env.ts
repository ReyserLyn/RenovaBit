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
 * URL base del sitio público (tienda).
 * Se configura con VITE_SITE_URL en .env / .env.production.
 * Producción: https://tienda.renovabit.com
 * Desarrollo: http://localhost:3003
 */
export function getSiteUrl(): string {
	return import.meta.env.VITE_SITE_URL ?? process.env.VITE_SITE_URL ?? "http://localhost:3003";
}

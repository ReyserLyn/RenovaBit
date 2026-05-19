import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { Elysia } from "elysia";
import { auth } from "@/utils/auth/auth";
import { logger } from "@/utils/logger";

type Session = typeof auth.$Infer.Session;
export type AuthUser = Session["user"];

/**
 * Comprueba si el usuario tiene rol de administrador.
 */
export const isAdminUser = (user: AuthUser | null): boolean => user?.role === "admin";

/**
 * Obtiene la sesión actual desde los headers de la request.
 * Devuelve null si no hay sesión o si ocurre un error.
 */
async function getSessionFromHeaders(
	headers: Headers | Record<string, string>,
): Promise<Session | null> {
	const headersObj =
		headers instanceof Headers ? headers : new Headers(headers as Record<string, string>);

	try {
		return await auth.api.getSession({ headers: headersObj });
	} catch (error) {
		logger
			.withMetadata({ error: error instanceof Error ? error.message : "Unknown error" })
			.error("[Auth] Error al obtener sesión");
		return null;
	}
}

// ---------------------------------------------------------------------------
// AuthModule — plugin de Elysia
// ---------------------------------------------------------------------------

export const AuthModule = new Elysia({
	name: "auth",
})
	.all("/auth*", ({ request }) => auth.handler(request), {
		parse: "none",
		detail: { hide: true },
	})
	.macro({
		isAuth: {
			async resolve({ request: { headers } }) {
				const session = await getSessionFromHeaders(headers);
				if (!session) {
					throw createApiError({
						code: BackendErrorCodes.INVALID_CREDENTIALS,
						message: "No autorizado. Inicia sesión para continuar.",
						logLevel: "info",
						doNotLog: true,
					});
				}
				return { user: session.user, session: session.session };
			},
		},
		isAdmin: {
			async resolve({ request: { headers } }) {
				const session = await getSessionFromHeaders(headers);
				if (!session) {
					throw createApiError({
						code: BackendErrorCodes.INVALID_CREDENTIALS,
						message: "No autorizado. Inicia sesión para continuar.",
						logLevel: "info",
						doNotLog: true,
					});
				}
				if (session.user.role !== "admin") {
					throw createApiError({
						code: BackendErrorCodes.ACCESS_DENIED,
						message: "Acceso denegado. Se requiere rol de administrador.",
						logLevel: "info",
						doNotLog: true,
					});
				}
				return { user: session.user, session: session.session };
			},
		},
		isOwnerOrAdmin: {
			async resolve({ request: { headers }, params }) {
				const session = await getSessionFromHeaders(headers);
				if (!session) {
					throw createApiError({
						code: BackendErrorCodes.INVALID_CREDENTIALS,
						message: "No autorizado. Inicia sesión para continuar.",
						logLevel: "info",
						doNotLog: true,
					});
				}

				// Los administradores siempre tienen acceso
				if (session.user.role === "admin") {
					return { user: session.user, session: session.session };
				}

				// Extrae el ID del recurso de los parámetros de forma segura
				const resourceId = (params as Record<string, string> | undefined)?.id;

				if (!resourceId) {
					throw createApiError({
						code: BackendErrorCodes.ACCESS_DENIED,
						message: "ID de recurso no especificado",
						logLevel: "info",
						doNotLog: true,
					});
				}

				// Verifica si el usuario es propietario del recurso
				if (session.user.id !== resourceId) {
					throw createApiError({
						code: BackendErrorCodes.ACCESS_DENIED,
						message: "Acceso denegado. Solo puedes acceder a tus propios recursos.",
						logLevel: "info",
						doNotLog: true,
					});
				}

				return { user: session.user, session: session.session };
			},
		},
	});

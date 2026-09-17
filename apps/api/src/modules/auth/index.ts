import { BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { Elysia } from "elysia";
import { auth } from "@/utils/auth/auth";
import { logger } from "@/utils/logger";

type Session = typeof auth.$Infer.Session;
export type AuthUser = Session["user"];

/**
 * Obtiene la sesión actual desde los headers de la request.
 * Devuelve null si no hay sesión o si ocurre un error.
 */
async function getSessionFromHeaders(
	headers: Headers | Record<string, string>,
): Promise<Session | null> {
	const headersObj = headers instanceof Headers ? headers : new Headers(Object.entries(headers));

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

export const AuthMacros = new Elysia({
	name: "auth-macros",
}).macro({
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
});

const AuthRoutes = new Elysia({
	name: "auth-routes",
}).all("/auth*", ({ request }) => auth.handler(request), {
	parse: "none",
	detail: { hide: true },
});

/**
 * Full auth module: macros plus the Better Auth catch-all. Mount it ONCE at
 * the API root (modules/index.ts). Modules that only need the macro-provided
 * context types must use `AuthMacros` instead — using AuthModule inside a
 * module prefix would also mount the public /auth* handler under that prefix.
 */
export const AuthModule = new Elysia({
	name: "auth",
})
	.use(AuthMacros)
	.use(AuthRoutes);

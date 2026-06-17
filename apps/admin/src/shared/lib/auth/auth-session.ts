import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { getApiBaseUrl } from "@/shared/lib/env";
import type { Session } from "./auth-client";

// ── Server function — obtiene la sesión desde la API ──

export const getSessionServerFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<Session | null> => {
		try {
			const headers = getRequestHeaders();

			const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/get-session`, {
				headers: { cookie: headers.get("cookie") ?? "" },
			});

			if (!response.ok) return null;

			const data: unknown = await response.json();
			if (!data || typeof data !== "object" || Array.isArray(data)) return null;
			if (!("user" in data) || typeof data.user !== "object" || data.user === null) return null;

			// ⚠️ Único `as` justificado: Better Auth catch-all no está tipado en Elysia.
			// Validación runtime antes del cast garantiza seguridad.
			return data as Session;
		} catch {
			return null;
		}
	},
);

// ── TanStack Query — cache de sesión ────────────────

export const authKeys = {
	all: ["auth"] as const,
	session: () => [...authKeys.all, "session"] as const,
};

export function authSessionQueryOptions() {
	return queryOptions({
		queryKey: authKeys.session(),
		queryFn: () => getSessionServerFn(),
		staleTime: 1000 * 60 * 2, // 2 min (reducido para reflejar revocación más rápido)
		gcTime: 1000 * 60 * 30, // 30 min
		retry: false,
	});
}

// ── Helpers ─────────────────────────────────────────

export function isAdmin(session: Session | null | undefined): boolean {
	return session?.user?.role === "admin";
}

export async function invalidateAuthQueries(queryClient: QueryClient): Promise<void> {
	await queryClient.invalidateQueries({ queryKey: authKeys.all });
}

export async function resetAuthState(queryClient: QueryClient): Promise<void> {
	queryClient.removeQueries({ queryKey: authKeys.all });
}

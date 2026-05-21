import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { Session } from "./auth-client";

// ── Server function — obtiene la sesión desde la API ──

export const getSessionServerFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<Session | null> => {
		const request = getRequest();
		if (!request) return null;

		try {
			const apiUrl = process.env.VITE_API_URL ?? "http://localhost:3001";
			const response = await fetch(`${apiUrl}/api/v1/auth/get-session`, {
				headers: request.headers,
				credentials: "include",
			});

			if (!response.ok) return null;

			return (await response.json()) as Session;
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
		staleTime: 1000 * 60 * 5, // 5 min
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

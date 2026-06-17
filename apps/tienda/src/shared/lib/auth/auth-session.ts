import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { api } from "@/shared/lib/api/api-client";
import { getApiBaseUrl } from "@/shared/lib/env";
import type { Session } from "./auth-client";

// ── Server function — session via API ──────────────

export const getSessionServerFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<Session | null> => {
		try {
			const reqHeaders = getRequestHeaders();
			const cookie = reqHeaders.get("cookie") ?? "";
			const apiUrl = getApiBaseUrl();

			const response = await fetch(`${apiUrl}/api/v1/auth/get-session`, {
				headers: { cookie },
			});

			if (!response.ok) return null;

			const data: unknown = await response.json();
			if (!data || typeof data !== "object") return null;
			const raw = data as Record<string, unknown>;
			if (!raw.user || typeof raw.user !== "object") return null;

			return {
				user: raw.user as Session["user"],
				session: raw.session as Session["session"],
			} as Session;
		} catch {
			return null;
		}
	},
);

// ── TanStack Query — session cache ─────────────────

export const authKeys = {
	all: ["auth"] as const,
	session: () => [...authKeys.all, "session"] as const,
};

export function authSessionQueryOptions() {
	return queryOptions({
		queryKey: authKeys.session(),
		queryFn: () => getSessionServerFn(),
		staleTime: 1000 * 60 * 15, // 15 min
		gcTime: 1000 * 60 * 30, // 30 min
		retry: false,
	});
}

// ── Helpers ─────────────────────────────────────────

export function isCustomer(session: Session | null | undefined): boolean {
	return session?.user?.role === "customer";
}

export async function invalidateAuthQueries(queryClient: QueryClient): Promise<void> {
	await queryClient.invalidateQueries({ queryKey: authKeys.all });
}

export async function resetAuthState(queryClient: QueryClient): Promise<void> {
	queryClient.removeQueries({ queryKey: authKeys.all });
}

// ── Profile query — for profile page and navbar SSR ──

export const profileKeys = {
	all: ["profile"] as const,
};

/** Server function: fetches fresh profile from DB via Eden Treaty, bypassing Better Auth cookie cache. */
export const getProfileServerFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<{ image: string | null } | null> => {
		try {
			const reqHeaders = getRequestHeaders();
			const cookie = reqHeaders.get("cookie") ?? "";

			const { data, error } = await api.api.v1.users.me.get({
				headers: { cookie },
			});

			if (error || !data) return null;

			return {
				image: typeof data.image === "string" ? data.image : null,
			};
		} catch {
			return null;
		}
	},
);

export function profileQueryOptions() {
	return queryOptions({
		queryKey: profileKeys.all,
		queryFn: () => getProfileServerFn(),
		staleTime: 1000 * 60 * 5,
		gcTime: 1000 * 60 * 30,
		retry: false,
	});
}

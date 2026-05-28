import type { auth } from "@renovabit/backend-client";
import { createAuthClient } from "better-auth/client";
import { adminClient, inferAdditionalFields, usernameClient } from "better-auth/client/plugins";

function getApiBaseUrl(): string {
	return import.meta.env.VITE_API_URL ?? process.env.VITE_API_URL ?? "http://localhost:3001";
}

export const authClient = createAuthClient({
	baseURL: getApiBaseUrl(),
	basePath: "/api/v1/auth",
	sessionOptions: {
		refetchInterval: 5 * 60,
		refetchOnWindowFocus: true,
	},
	fetchOptions: {
		onError: async (context) => {
			if (context.response.status === 429) {
				const retryAfter = context.response.headers.get("X-Retry-After");
				throw new Error(
					`Demasiados intentos. Espera ${retryAfter} segundos antes de volver a intentar.`,
				);
			}
		},
	},
	plugins: [usernameClient(), adminClient(), inferAdditionalFields<typeof auth>()],
});

export type Session = typeof authClient.$Infer.Session;
export type User = Session["user"];

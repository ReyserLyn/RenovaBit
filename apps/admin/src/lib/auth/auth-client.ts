import type { auth } from "@renovabit/backend-client";
import { createAuthClient } from "better-auth/client";
import { adminClient, inferAdditionalFields, usernameClient } from "better-auth/client/plugins";

function getApiBaseUrl(): string {
	return process.env.VITE_API_URL ?? "http://localhost:3001";
}

export const authClient = createAuthClient({
	baseURL: getApiBaseUrl(),
	basePath: "/api/v1/auth",
	sessionOptions: {
		refetchInterval: 5 * 60,
		refetchOnWindowFocus: true,
	},
	plugins: [usernameClient(), adminClient(), inferAdditionalFields<typeof auth>()],
});

export type Session = typeof authClient.$Infer.Session;
export type User = Session["user"];

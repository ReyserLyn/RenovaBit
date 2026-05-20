import { treaty } from "@elysiajs/eden";
import type { App } from "@renovabit/api";
import type { auth } from "@renovabit/api/auth";

export type { App } from "@renovabit/api";
export type { auth };

export type ApiClient = ReturnType<typeof treaty<App>>;

export function createApiClient(baseUrl: string): ApiClient {
	return treaty<App>(baseUrl, {
		fetch: {
			credentials: "include",
			mode: "cors",
		},
	});
}

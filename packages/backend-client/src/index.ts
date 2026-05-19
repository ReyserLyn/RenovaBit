import { treaty } from "@elysiajs/eden";
import type { App } from "@renovabit/api";

export type { App } from "@renovabit/api";

export type ApiClient = ReturnType<typeof treaty<App>>;

export function createApiClient(baseUrl: string): ApiClient {
	return treaty<App>(baseUrl, {
		fetch: {
			credentials: "include",
			mode: "cors",
		},
	});
}

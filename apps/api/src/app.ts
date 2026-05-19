import { cors } from "@elysiajs/cors";
import { elysiaLogLayer } from "@loglayer/elysia";
import { Elysia } from "elysia";
import { nanoid } from "nanoid";
import { errorHandler } from "./utils/error-handler";
import { logger } from "./utils/logger";

export function createApp() {
	return new Elysia()
		.use(cors())
		.use(
			elysiaLogLayer({
				instance: logger,
				requestId: () => nanoid(12),
				autoLogging: {
					ignore: ["/health"],
				},
				contextFn: ({ request }) => ({
					ua: request.headers.get("user-agent"),
				}),
			}),
		)
		.onError(errorHandler)
		.get("/", () => "Hello Elysia")
		.get("/health", () => "ok");
}

export type App = ReturnType<typeof createApp>;

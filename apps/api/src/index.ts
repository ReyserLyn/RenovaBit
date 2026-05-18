import { elysiaLogLayer } from "@loglayer/elysia";
import { Elysia } from "elysia";
import { nanoid } from "nanoid";
import { errorHandler } from "./utils/error-handler";
import { logger } from "./utils/logger";

const app = new Elysia()
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
	.get("/health", () => "ok")
	.listen(3000);

logger.info(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);

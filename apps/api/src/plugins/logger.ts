import { elysiaLogLayer } from "@loglayer/elysia";
import { Elysia } from "elysia";
import { nanoid } from "nanoid";
import { logger } from "../utils/logger";

export const LoggerPlugin = new Elysia({ name: "logger" }).use(
	elysiaLogLayer({
		instance: logger,
		requestId: () => nanoid(12),
		autoLogging: {
			ignore: [],
		},
		contextFn: ({ request }) => ({
			ua: request.headers.get("user-agent"),
		}),
	}),
);

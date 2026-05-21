import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { modules } from "./modules";
import { DocsPlugin } from "./plugins/docs";
import { errorHandler } from "./plugins/error-handler";
import { LoggerPlugin } from "./plugins/logger";
import { logger } from "./utils/logger";
import { appOrigins } from "./utils/origins";

const app = new Elysia()
	.use(
		cors({
			origin: process.env.NODE_ENV === "production" ? appOrigins : true,
			methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization"],
			exposeHeaders: ["x-retry-after"],
			credentials: true,
			maxAge: 86400,
		}),
	)
	.use(LoggerPlugin)
	.get("/favicon.ico", () => Bun.file("public/favicon.ico"))
	.use(DocsPlugin)
	.use(modules)
	.onError(errorHandler)
	.listen(3001);

logger.info(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;

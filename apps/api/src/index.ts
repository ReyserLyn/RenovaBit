import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { modules } from "./modules";
import { DocsPlugin } from "./plugins/docs";
import { errorHandler } from "./plugins/error-handler";
import { LoggerPlugin } from "./plugins/logger";
import { logger } from "./utils/logger";

const app = new Elysia()
	.use(cors())
	.use(LoggerPlugin)
	.use(DocsPlugin)
	.use(modules)
	.onError(errorHandler)
	.listen(3001);

logger.info(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;

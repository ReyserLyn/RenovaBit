import { Elysia } from "elysia";
import { modules } from "./modules";
import { bullBoardPlugin } from "./plugins/bull-board";
import { CorsPlugin } from "./plugins/cors";
import { DocsPlugin } from "./plugins/docs";
import { errorHandler } from "./plugins/error-handler";
import { LoggerPlugin } from "./plugins/logger";
import { logger } from "./utils/logger";
import "@/jobs";

const app = new Elysia()
	.use(CorsPlugin)
	.use(LoggerPlugin)
	.get("/favicon.ico", () => Bun.file("public/favicon.ico"))
	.use(DocsPlugin)
	.use(bullBoardPlugin)
	.use(modules)
	.onError(errorHandler)
	.listen(3001);

logger.info(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;

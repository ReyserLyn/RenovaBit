import "@/jobs";
import { Elysia } from "elysia";
import { modules } from "./modules";
import { bullBoardPlugin } from "./plugins/bull-board";
import { CorsPlugin } from "./plugins/cors";
import { DocsPlugin } from "./plugins/docs";
import { errorHandler } from "./plugins/error-handler";
import { LoggerPlugin } from "./plugins/logger";
import { registerShutdown, setAppInstance, shutdownPlugin } from "./plugins/shutdown";
import { logger } from "./utils/logger";

registerShutdown();

const app = new Elysia()
	.use(CorsPlugin)
	.use(LoggerPlugin)
	.get("/favicon.ico", () => Bun.file("public/favicon.ico"))
	.use(DocsPlugin)
	.use(bullBoardPlugin)
	.use(modules)
	.use(shutdownPlugin)
	.onError(errorHandler)
	.listen(3001);

setAppInstance(app);

logger.info(`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;

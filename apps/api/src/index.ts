import { createApp } from "./app";
import { logger } from "./utils/logger";

const app = createApp().listen(3001);

logger.info(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);

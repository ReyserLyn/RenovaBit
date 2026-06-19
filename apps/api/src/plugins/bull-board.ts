import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ElysiaAdapter } from "@bull-board/elysia";
import { ApiError, BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { Elysia } from "elysia";
import { ordersQueue } from "@/jobs/orders.queue";
import { scrapingQueue } from "@/jobs/scraping.queue";
import { auth } from "@/utils/auth/auth";
import { logger } from "@/utils/logger";

const serverAdapter = new ElysiaAdapter({
	prefix: "/queues",
	basePath: "/admin/queues",
});

createBullBoard({
	queues: [new BullMQAdapter(scrapingQueue), new BullMQAdapter(ordersQueue)],
	serverAdapter,
	options: {
		uiBasePath: "node_modules/@bull-board/ui",
	},
});

const rawPlugin = await serverAdapter.registerPlugin();

export const bullBoardPlugin = new Elysia({ name: "bull-board" }).group("/admin", (app) =>
	app
		.onBeforeHandle(async ({ request }) => {
			try {
				const session = await auth.api.getSession({
					headers: request.headers,
				});
				if (!session) {
					throw createApiError({
						code: BackendErrorCodes.INVALID_CREDENTIALS,
						message: "No autorizado. Inicia sesión para continuar.",
						logLevel: "info",
						doNotLog: true,
					});
				}
				if (session.user.role !== "admin") {
					throw createApiError({
						code: BackendErrorCodes.ACCESS_DENIED,
						message: "Acceso denegado. Se requiere rol de administrador.",
						logLevel: "info",
						doNotLog: true,
					});
				}
			} catch (err) {
				if (err instanceof ApiError) throw err;
				logger.withError(err).warn("[BullBoard] Error al validar sesión");
				throw createApiError({
					code: BackendErrorCodes.INVALID_CREDENTIALS,
					message: "No autorizado",
					logLevel: "info",
					doNotLog: true,
				});
			}
		})
		.use(rawPlugin),
);

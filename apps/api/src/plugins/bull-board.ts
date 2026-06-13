import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ElysiaAdapter } from "@bull-board/elysia";
import { Elysia } from "elysia";
import { ordersQueue } from "@/jobs/orders.queue";
import { scrapingQueue } from "@/jobs/scraping.queue";
import { auth } from "@/utils/auth/auth";

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
		.onBeforeHandle(async ({ request, set }) => {
			try {
				const session = await auth.api.getSession({
					headers: request.headers,
				});
				if (!session || session.user.role !== "admin") {
					set.status = 403;
					return { error: "Acceso denegado" };
				}
			} catch {
				set.status = 401;
				return { error: "No autorizado" };
			}
		})
		.use(rawPlugin),
);

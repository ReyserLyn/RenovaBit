import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ElysiaAdapter } from "@bull-board/elysia";
import { scrapingQueue } from "@/jobs/scraping.queue";

const serverAdapter = new ElysiaAdapter({
	prefix: "/queues",
	basePath: "/admin/queues",
});

createBullBoard({
	queues: [new BullMQAdapter(scrapingQueue)],
	serverAdapter,
	options: {
		uiBasePath: "node_modules/@bull-board/ui",
	},
});

export const bullBoardPlugin = await serverAdapter.registerPlugin();

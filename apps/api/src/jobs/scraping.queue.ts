import { logger } from "@/utils/logger";
import { createQueue } from "@/utils/queue";

export const scrapingQueue = createQueue("scraping", {
	defaultJobOptions: {
		attempts: 1,
	},
});

export function enqueueManualScraping(limit: number, userId?: string) {
	return scrapingQueue.add(
		"run",
		{ limit, trigger: "manual", userId },
		{ priority: 1, attempts: 1 },
	);
}

scrapingQueue
	.add(
		"run",
		{ limit: 700, trigger: "automatic" },
		{
			attempts: 1,
			repeat: { every: 600_000, key: "auto-scraping" },
		},
	)
	.catch((err) => {
		logger.withError(err).warn("No se pudo registrar repeatable job");
	});

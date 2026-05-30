import { logger } from "@/utils/logger";
import { createQueue } from "@/utils/queue";

export const scrapingQueue = createQueue("scraping", {
	defaultJobOptions: {
		attempts: 3,
		backoff: { type: "exponential", delay: 2000 },
	},
});

export function enqueueManualScraping(limit: number) {
	return scrapingQueue.add("run", { limit, trigger: "manual" }, { priority: 1 });
}

scrapingQueue
	.add(
		"run",
		{ limit: 100, trigger: "automatic" },
		{
			repeat: { every: 300_000, key: "auto-scraping" },
		},
	)
	.catch((err) => {
		logger.withError(err).warn("No se pudo registrar repeatable job");
	});

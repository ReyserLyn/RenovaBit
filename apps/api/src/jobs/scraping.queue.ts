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

const REPEATABLE_JOB_ID = "auto-scraping";

scrapingQueue
	.add(
		"run",
		{ limit: 50, trigger: "automatic" },
		{
			jobId: REPEATABLE_JOB_ID,
			repeat: { every: 300_000 },
		},
	)
	.catch((err) => {
		logger.withError(err).warn("No se pudo registrar repeatable job");
	});

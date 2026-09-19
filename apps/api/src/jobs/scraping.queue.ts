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

// Job Scheduler (idempotente en cada boot). BullMQ v6 eliminó `repeat`.
scrapingQueue
	.upsertJobScheduler(
		"auto-scraping",
		{ every: 600_000 },
		{ name: "run", data: { limit: 2000, trigger: "automatic" }, opts: { attempts: 1 } },
	)
	.catch((err) => {
		logger.withError(err).warn("No se pudo registrar el scheduler de scraping");
	});

import { logger } from "@/utils/logger";
import { createQueue } from "@/utils/queue";

/**
 * Queue para jobs de scraping.
 */
export const scrapingQueue = createQueue("scraping", {
	defaultJobOptions: {
		attempts: 3,
		backoff: { type: "exponential", delay: 2000 },
	},
});

/**
 * Encola scraping manual con prioridad sobre el repeatable.
 */
export function enqueueManualScraping(limit: number) {
	return scrapingQueue.add("run", { limit }, { priority: 1 });
}

// ── Repeatable job temporal: cada 5 minutos ───────
// TODO: cambiar a 1_800_000 (30 min) para producción
const REPEATABLE_JOB_ID = "auto-scraping";

scrapingQueue
	.add("run", { limit: 50 }, { jobId: REPEATABLE_JOB_ID, repeat: { every: 300_000 } })
	.then(() => {
		logger
			.withMetadata({ jobId: REPEATABLE_JOB_ID, everyMs: 300_000 })
			.info("Scraping repeatable job registered");
	})
	.catch((err) => {
		logger.withError(err).warn("No se pudo registrar repeatable job");
	});

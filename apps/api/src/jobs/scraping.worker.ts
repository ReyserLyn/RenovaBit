import { Worker } from "bullmq";
import { cleanupOrphanedReports, runSync } from "@/modules/product-processing/sync/sync.service";
import { scrapingService } from "@/modules/scrapping/service";
import { logger } from "@/utils/logger";
import { connection } from "@/utils/queue";

type ScrapingJobData = {
	limit: number;
	trigger: "manual" | "automatic";
};

// Cleanup orphaned reports from previous crash
await cleanupOrphanedReports();

export const scrapingWorker = new Worker<ScrapingJobData>(
	"scraping",
	async (job) => {
		const { limit } = job.data;
		const trigger = job.data.trigger || "automatic";

		logger.withMetadata({ jobId: job.id, limit, trigger }).info("Iniciando scraping job");

		const items = await scrapingService.fetchProductList(limit);
		const { reportId, stats } = await runSync(items, trigger, job.id);

		logger.withMetadata({ jobId: job.id, reportId, ...stats }).info("Job de scraping completado");

		return { reportId, stats };
	},
	{
		connection,
		concurrency: 1,
		lockDuration: 120_000,
		stalledInterval: 60_000,
	},
);

scrapingWorker.on("completed", (job) => {
	logger.withMetadata({ jobId: job.id }).info("Job de scraping completado");
});

scrapingWorker.on("failed", (job, err) => {
	logger.withMetadata({ jobId: job?.id }).withError(err).error("Job de scraping falló");
});

scrapingWorker.on("stalled", (jobId) => {
	logger.withMetadata({ jobId }).warn("Job de scraping estancado");
});

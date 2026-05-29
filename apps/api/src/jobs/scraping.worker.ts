import { Worker } from "bullmq";
import { scrapingService } from "@/modules/scrapping/service";
import { logger } from "@/utils/logger";
import { connection } from "@/utils/queue";

type ScrapingJobData = {
	limit: number;
};

export const scrapingWorker = new Worker<ScrapingJobData>(
	"scraping",
	async (job) => {
		logger.withMetadata({ jobId: job.id, limit: job.data.limit }).info("Iniciando scraping job");

		const items = await scrapingService.fetchProductList(job.data.limit);

		return items;
	},
	{
		connection,
		concurrency: 1,
		lockDuration: 60_000,
		stalledInterval: 30_000,
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

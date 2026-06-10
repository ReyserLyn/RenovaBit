import { Worker } from "bullmq";
import { createNotification, getAdminIds } from "@/modules/notifications/notifications.service";
import { cleanupOrphanedReports, runSync } from "@/modules/product-processing/sync/sync.service";
import { scrapingService } from "@/modules/scrapping/service";
import { broadcastToAdmins } from "@/plugins/websocket";
import { logger } from "@/utils/logger";
import { connection } from "@/utils/queue";
import { getRedis } from "@/utils/redis";

type ScrapingJobData = {
	limit: number;
	trigger: "manual" | "automatic";
	userId?: string;
};

// Previene ejecuciones back-to-back: si el scheduler encoló un job mientras este
// corría (concurrency=1), al terminar el worker lo agarra en ms. El cooldown de
// 2 s lo omite. El siguiente slot (9:10) pasa normalmente — la clave ya expiró.
const SYNC_COOLDOWN_KEY = "scraping:sync:cooldown";
const SYNC_COOLDOWN_TTL = 2;

// Cleanup orphaned reports from previous crash
await cleanupOrphanedReports();

export const scrapingWorker = new Worker<ScrapingJobData>(
	"scraping",
	async (job) => {
		const redis = getRedis();

		// Omitir si el job anterior terminó hace < 2 s (evita back-to-back)
		const inCooldown = await redis.get(SYNC_COOLDOWN_KEY).catch(() => null);

		if (inCooldown) {
			logger
				.withMetadata({ jobId: job.id, trigger: job.data.trigger })
				.info("Cooldown activo — omitiendo");
			return { skipped: true };
		}

		const { limit } = job.data;
		const trigger = job.data.trigger || "automatic";

		logger.withMetadata({ jobId: job.id, limit, trigger }).info("Iniciando scraping job");

		try {
			const items = await scrapingService.fetchProductList(limit);
			const { reportId, stats, startedAt } = await runSync(items, trigger, job.id, (progress) => {
				broadcastToAdmins({
					type: "sync:progress",
					jobId: job.id,
					...progress,
				});
			});

			const completedAt = new Date().toISOString();

			logger.withMetadata({ jobId: job.id, reportId, ...stats }).info("Job de scraping completado");

			broadcastToAdmins({
				type: "sync:completed",
				jobId: job.id,
				reportId,
				stats,
				trigger,
			});

			// Crear notificación en DB
			const targetUsers = job.data.userId ? [job.data.userId] : await getAdminIds();

			for (const userId of targetUsers) {
				await createNotification({
					userId,
					type: "sync_completed",
					title: "Sincronización completada",
					message: `${stats.processed} procesados | ${stats.created} creados | ${stats.updated} actualizados | ${stats.errors} errores`,
					data: {
						reportId,
						jobId: job.id,
						trigger,
						stats,
						startedAt,
						completedAt,
					},
				});
			}

			return { reportId, stats };
		} finally {
			await redis.set(SYNC_COOLDOWN_KEY, "1", "EX", SYNC_COOLDOWN_TTL).catch((err) => {
				logger
					.withMetadata({ jobId: job.id })
					.withError(err as Error)
					.warn("No se pudo establecer cooldown en Redis");
			});
		}
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

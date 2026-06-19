import { Elysia } from "elysia";
import { logger } from "@/utils/logger";

/**
 * Graceful shutdown. Closes BullMQ workers (waits for in-flight jobs),
 * then Elysia stops the HTTP server. Idempotent — repeated calls are no-ops.
 *
 * Invoke `registerShutdown()` once at startup to install SIGTERM/SIGINT
 * handlers. The `onStop` hook is registered separately for the normal
 * Elysia shutdown path.
 */
let shuttingDown = false;

export async function shutdown(reason: string): Promise<void> {
	if (shuttingDown) return;
	shuttingDown = true;

	logger.withMetadata({ reason }).info("Shutting down...");

	try {
		const { scrapingWorker } = await import("@/jobs/scraping.worker");
		const { ordersWorker } = await import("@/jobs/orders.worker");
		await Promise.allSettled([scrapingWorker?.close(), ordersWorker?.close()]);
	} catch (err) {
		logger.withError(err as Error).error("Error during worker shutdown");
	}

	logger.info("Shutdown complete");
	process.exit(0);
}

export const shutdownPlugin = new Elysia({ name: "shutdown" }).onStop(async () => {
	if (shuttingDown) return;
	logger.info("Elysia onStop — cerrando workers...");
	try {
		const { scrapingWorker } = await import("@/jobs/scraping.worker");
		const { ordersWorker } = await import("@/jobs/orders.worker");
		await Promise.allSettled([scrapingWorker?.close(), ordersWorker?.close()]);
	} catch (err) {
		logger.withError(err as Error).error("Error closing workers in onStop");
	}
	logger.info("Workers closed");
});

export function registerShutdown(): void {
	process.on("uncaughtException", (err) => {
		logger.withError(err).fatal?.("uncaughtException") ??
			logger.withError(err).error("uncaughtException");
		void shutdown("uncaughtException");
	});

	process.on("unhandledRejection", (reason) => {
		logger.withMetadata({ reason }).fatal?.("unhandledRejection") ??
			logger.withMetadata({ reason }).error("unhandledRejection");
		void shutdown("unhandledRejection");
	});

	process.on("SIGTERM", () => void shutdown("SIGTERM"));
	process.on("SIGINT", () => void shutdown("SIGINT"));
}

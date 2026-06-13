import { Worker } from "bullmq";
import { OrderService } from "@/modules/orders/service";
import { logger } from "@/utils/logger";
import { connection } from "@/utils/queue";

type AutoCancelData = { orderId: string };

function assertAutoCancelData(data: unknown): asserts data is AutoCancelData {
	if (typeof data !== "object" || data === null) {
		throw new Error("Invalid auto-cancel job data: expected object");
	}
	const orderId = Reflect.get(data, "orderId");
	if (typeof orderId !== "string") {
		throw new Error("Invalid auto-cancel job data: orderId must be string");
	}
}

export const ordersWorker = new Worker(
	"orders",
	async (job) => {
		if (job.name === "auto-cancel") {
			assertAutoCancelData(job.data);
			const { orderId } = job.data;
			const cancelled = await OrderService.cancelIfStillPending(orderId);
			return { cancelled, orderId };
		}
		if (job.name === "safety-net") {
			const cancelled = await OrderService.autoCancelExpiredPending();
			return { cancelled: cancelled.length };
		}
		return { skipped: true, reason: `unknown_job:${job.name}` };
	},
	{
		connection,
		concurrency: 1,
		lockDuration: 60_000,
		stalledInterval: 60_000,
	},
);

ordersWorker.on("completed", (job, result) => {
	logger.withMetadata({ jobId: job.id, name: job.name, result }).info("orders job completed");
});

ordersWorker.on("failed", (job, err) => {
	logger
		.withMetadata({ jobId: job?.id, name: job?.name })
		.withError(err)
		.error("orders job failed");
});

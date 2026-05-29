import type { QueueOptions } from "bullmq";
import { Queue } from "bullmq";
import { redisConnectionConfig } from "@/utils/redis";

const DEFAULT_JOB_OPTIONS = {
	attempts: 3,
	backoff: {
		type: "exponential" as const,
		delay: 1000,
	},
	removeOnComplete: { count: 1000 },
	removeOnFail: { count: 5000 },
};

const connection = {
	...redisConnectionConfig,
	maxRetriesPerRequest: null,
};

/**
 * Factory de queues con configuración saneada por defecto.
 */
export function createQueue(name: string, opts?: Omit<Partial<QueueOptions>, "connection">) {
	const { defaultJobOptions: custom, ...rest } = opts ?? {};

	return new Queue(name, {
		connection,
		defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, ...custom },
		...rest,
	});
}

export { connection };

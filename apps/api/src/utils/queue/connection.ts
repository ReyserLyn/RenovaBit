import { redisConnectionConfig } from "@/utils/redis";

/**
 * BullMQ connection config. Extracted to a separate module to avoid the
 * circular dependency between `utils/queue/index.ts` (factory) and the
 * workers that consume the connection.
 */
export const connection = {
	...redisConnectionConfig,
	maxRetriesPerRequest: null,
};

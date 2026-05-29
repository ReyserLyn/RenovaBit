import Redis, { type RedisOptions } from "ioredis";
import { logger } from "@/utils/logger";

const REDIS_HOST = process.env.REDIS_HOST ?? "localhost";
const REDIS_PORT = Number.parseInt(process.env.REDIS_PORT ?? "6379", 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const REDIS_DB = Number.parseInt(process.env.REDIS_DB ?? "0", 10);

export const redisConnectionConfig = {
	host: REDIS_HOST,
	port: REDIS_PORT,
	password: REDIS_PASSWORD,
	db: REDIS_DB,
};

const baseConfig: RedisOptions = {
	...redisConnectionConfig,
	retryStrategy: (times) => {
		if (times > 10) return null;
		return Math.min(100 * 2 ** (times - 1), 3000);
	},
	reconnectOnError: (err) =>
		["ECONNREFUSED", "ETIMEDOUT", "ECONNRESET", "EPIPE"].some((e) => err.message.includes(e)),
	connectTimeout: 10_000,
	commandTimeout: 5_000,
	lazyConnect: true,
	enableAutoPipelining: true,
};

function createClient(name: string, opts?: RedisOptions): Redis {
	const client = new Redis({ ...baseConfig, ...opts });

	client.on("error", (err) => {
		logger.withMetadata({ name }).withError(err).error("Error de Redis");
	});

	client.on("ready", () => {
		logger.info(`Redis ${name} listo`);
	});

	return client;
}

// ── Cache / General purpose ────────────────────────
const _redis = createClient("main", { maxRetriesPerRequest: 3 });

export function getRedis(): Redis {
	return _redis;
}

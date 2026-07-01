import type { Context, Options } from "elysia-rate-limit";
import type Redis from "ioredis";

/**
 * Redis-backed context for elysia-rate-limit.
 *
 * Uses a shared Redis singleton (from @/utils/redis) so rate-limit state
 * survives across API instances. Key format: `<prefix><tier>:<resolvedIp>`.
 *
 * `kill()` is intentionally a noop — the Redis singleton is shared with
 * Better Auth secondary storage and BullMQ queues; it is disconnected by
 * the shutdown plugin, not by individual feature plugins.
 */
export class RedisContext implements Context {
	private readonly redis: Redis;
	private readonly keyPrefix: string;

	constructor(redis: Redis, keyPrefix: string) {
		this.redis = redis;
		this.keyPrefix = keyPrefix;
	}

	init(_options: Omit<Options, "context">): void {
		// No initialization needed — redis client is already connected lazily.
	}

	async increment(
		key: string,
		duration?: number,
		requestTime?: number,
	): Promise<{ count: number; nextReset: Date; start: number }> {
		const now = requestTime ?? Date.now();
		const effectiveDuration = duration as number;
		const prefixedKey = `${this.keyPrefix}${key}`;

		// Atomic INCR — creates the key or increments the existing one
		const rawCount = await this.redis.incr(prefixedKey);
		const count = typeof rawCount === "number" ? rawCount : Number(rawCount);

		// Set TTL only when a new window starts (NX = only if key has no expiry).
		// If the key already exists without a TTL (edge case from a race), this
		// still ensures the window eventually expires.
		await this.redis.pexpire(prefixedKey, effectiveDuration, "NX");

		// Read the actual TTL to compute the reset time
		const rawTtl = await this.redis.pttl(prefixedKey);
		const ttlMs = typeof rawTtl === "number" && rawTtl > 0 ? rawTtl : 0;

		const nextReset = new Date(now + ttlMs);
		const start = now;

		return { count, nextReset, start };
	}

	async decrement(key: string): Promise<void> {
		const prefixedKey = `${this.keyPrefix}${key}`;
		const raw = await this.redis.decr(prefixedKey);
		const count = typeof raw === "number" ? raw : Number(raw);

		// Never let the counter go below 0 — delete the key so the next INCR
		// starts a fresh window.
		if (count < 0) {
			await this.redis.del(prefixedKey);
		}
	}

	async reset(key?: string): Promise<void> {
		if (key) {
			await this.redis.del(`${this.keyPrefix}${key}`);
			return;
		}

		// SCAN for all keys matching the prefix
		const keysToDelete: string[] = [];
		let cursor = "0";

		do {
			const result = await this.redis.scan(cursor, "MATCH", `${this.keyPrefix}*`, "COUNT", 100);
			// result is [nextCursor, keys[]]
			const nextCursor = Array.isArray(result) ? result[0] : "0";
			const foundKeys = Array.isArray(result) ? (result[1] ?? []) : [];

			for (const k of foundKeys) {
				keysToDelete.push(k);
			}

			cursor = String(nextCursor);
		} while (cursor !== "0");

		if (keysToDelete.length > 0) {
			await this.redis.del(...keysToDelete);
		}
	}

	kill(): void {
		// Noop — Redis singleton is managed by the shutdown plugin.
	}
}

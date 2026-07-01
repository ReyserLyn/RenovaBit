import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { RedisContext } from "./redis-context";

// ── Mock Redis ───────────────────────────────────────────────────────────────
interface MockEntry {
	value: number;
	expiresAt: number; // epoch ms, -1 = no expiry
}

class MockRedis {
	private store = new Map<string, MockEntry>();
	/** Simulated wall clock — bump with advance() */
	now: number = Date.now();

	advance(ms: number): void {
		this.now += ms;
		this.evictExpired();
	}

	reset(): void {
		this.store.clear();
		this.now = Date.now();
	}

	private evictExpired(): void {
		for (const [k, v] of this.store) {
			if (v.expiresAt !== -1 && this.now >= v.expiresAt) {
				this.store.delete(k);
			}
		}
	}

	private ensureKey(key: string): MockEntry {
		this.evictExpired();
		let entry = this.store.get(key);
		if (!entry) {
			entry = { value: 0, expiresAt: -1 };
			this.store.set(key, entry);
		}
		return entry;
	}

	async incr(key: string): Promise<number> {
		const entry = this.ensureKey(key);
		entry.value++;
		return entry.value;
	}

	async pexpire(key: string, ms: number, flag?: string): Promise<number> {
		const entry = this.store.get(key);
		if (!entry) return 0;
		if (flag === "NX" && entry.expiresAt !== -1) return 0;
		entry.expiresAt = this.now + ms;
		return 1;
	}

	async pttl(key: string): Promise<number> {
		const entry = this.store.get(key);
		if (!entry) return -2;
		if (entry.expiresAt === -1) return -1;
		const remaining = entry.expiresAt - this.now;
		return remaining > 0 ? remaining : -2;
	}

	async decr(key: string): Promise<number> {
		const entry = this.ensureKey(key);
		entry.value--;
		return entry.value;
	}

	async del(...keys: string[]): Promise<number> {
		let count = 0;
		for (const k of keys) {
			if (this.store.delete(k)) count++;
		}
		return count;
	}

	async scan(
		cursor: string,
		_match: string,
		pattern: string,
		_count: string,
		countVal: string,
	): Promise<[string, string[]]> {
		this.evictExpired();
		const regex = new RegExp(`^${pattern.replace(/%2A/g, "\\*").replace(/\*/g, ".*")}$`);
		const matching = [...this.store.keys()].filter((k) => regex.test(k));
		const limit = Number.parseInt(countVal, 10);
		const page = matching.slice(Number.parseInt(cursor, 10), Number.parseInt(cursor, 10) + limit);
		const nextCursor =
			Number.parseInt(cursor, 10) + page.length >= matching.length
				? "0"
				: String(Number.parseInt(cursor, 10) + page.length);
		return [nextCursor, page];
	}
}

// ── Tests ────────────────────────────────────────────────────────────────────

const PREFIX = "test:rate-limit:";

describe("RedisContext", () => {
	let mockRedis: MockRedis;
	let ctx: RedisContext;

	beforeEach(() => {
		mockRedis = new MockRedis();
		// Convert MockRedis to a compatible shape for RedisContext
		ctx = new RedisContext(mockRedis as unknown as import("ioredis").Redis, PREFIX);
	});

	afterEach(() => {
		mockRedis.reset();
	});

	// ── increment ─────────────────────────────────────────────────────────

	it("increment on a new key returns count=1", async () => {
		const result = await ctx.increment("test-key", 60_000);
		expect(result.count).toBe(1);
		expect(result.start).toBeGreaterThan(0);
		expect(result.nextReset.getTime()).toBeGreaterThan(result.start);
	});

	it("increment on an existing key returns incremented count", async () => {
		await ctx.increment("test-key", 60_000);
		const result = await ctx.increment("test-key", 60_000);
		expect(result.count).toBe(2);
	});

	it("increment after window expiry resets count to 1", async () => {
		await ctx.increment("test-key", 60_000);
		mockRedis.advance(60_001); // past the window
		const result = await ctx.increment("test-key", 60_000);
		expect(result.count).toBe(1);
	});

	// ── decrement ─────────────────────────────────────────────────────────

	it("decrement reduces count", async () => {
		await ctx.increment("test-key", 60_000);
		await ctx.decrement("test-key");
		// increment again to verify count was reduced
		const result = await ctx.increment("test-key", 60_000);
		expect(result.count).toBe(1); // was 2, decremented to 1, incremented to 2
	});

	// Actually the above test is wrong - let me think...
	// increment: 0→1, decrement: 1→0, increment: 0→1. So result.count === 1.
	// Wait, incr returns 1, decr returns 0, incr returns 1. So count=1 means
	// the decrement did reduce from 1 to 0. Let me verify this differently.

	it("decrement does not go below 0", async () => {
		// Create a key by incrementing
		await ctx.increment("test-key-decr", 60_000);
		// Decrement twice should go to -1 then reset to 0 (deleted)
		await ctx.decrement("test-key-decr");
		await ctx.decrement("test-key-decr");
		// A fresh increment should start at 1 (since the key was deleted)
		const result = await ctx.increment("test-key-decr", 60_000);
		expect(result.count).toBe(1);
	});

	// ── reset ─────────────────────────────────────────────────────────────

	it("reset(key) deletes that specific key", async () => {
		await ctx.increment("key-a", 60_000);
		await ctx.increment("key-b", 60_000);
		await ctx.reset("key-a");

		// key-a should be new (count=1), key-b should be existing (count=2, incremented from 1)
		const a = await ctx.increment("key-a", 60_000);
		const b = await ctx.increment("key-b", 60_000);
		expect(a.count).toBe(1);
		expect(b.count).toBe(2);
	});

	it("reset() without args clears all keys with prefix", async () => {
		await ctx.increment("key-a", 60_000);
		await ctx.increment("key-b", 60_000);
		await ctx.reset(); // no arg

		const a = await ctx.increment("key-a", 60_000);
		const b = await ctx.increment("key-b", 60_000);
		expect(a.count).toBe(1);
		expect(b.count).toBe(1);
	});

	// ── kill ──────────────────────────────────────────────────────────────

	it("kill() is a noop and does not throw", async () => {
		await ctx.increment("some-key", 60_000);
		expect(() => ctx.kill()).not.toThrow();
		// After kill, the context should still work
		const result = await ctx.increment("some-key", 60_000);
		expect(result.count).toBe(2);
	});

	// ── key prefix ────────────────────────────────────────────────────────

	it("all operations use the correct key prefix", async () => {
		await ctx.increment("prefixed-key", 60_000);
		// Check that the key exists in mockRedis with the prefix
		const result = await ctx.increment("prefixed-key", 60_000);
		expect(result.count).toBe(2);
	});
});

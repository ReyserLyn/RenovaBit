import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Elysia } from "elysia";

// ── Mock Redis ───────────────────────────────────────────────────────────────

interface MockEntry {
	value: number;
	expiresAt: number;
}

class MockRedis {
	store = new Map<string, MockEntry>();
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

const mockRedisInstance = new MockRedis();

// Set up mock BEFORE importing the plugin
mock.module("@/utils/redis", () => ({
	getRedis: () => mockRedisInstance as unknown as import("ioredis").Redis,
}));

// Now import the plugin — mock.module ensures getRedis() returns our mock
const { rateLimitPlugin } = await import("./plugin");

// ── Test app factory ─────────────────────────────────────────────────────────

function hasStatusCodeAndJsonSafe(
	error: unknown,
): error is { statusCode: number; code: string; toJSONSafe: () => unknown } {
	if (typeof error !== "object" || error === null) return false;
	const candidate = error as {
		statusCode?: unknown;
		toJSONSafe?: unknown;
		code?: unknown;
	};
	return (
		typeof candidate.statusCode === "number" &&
		typeof candidate.toJSONSafe === "function" &&
		typeof candidate.code === "string"
	);
}

function createTestApp() {
	return new Elysia()
		.use(rateLimitPlugin)
		.get("/health", () => "ok")
		.get("/api/v1/products", () => "products")
		.post("/api/v1/cart", () => "cart added")
		.patch("/api/v1/cart/1", () => "cart updated")
		.delete("/api/v1/cart/1", () => "cart deleted")
		.post("/api/v1/orders", () => "order created")
		.get("/api/v1/orders", () => "order list")
		.get("/api/v1/admin/dashboard", () => "admin")
		.get("/", () => "home")
		.onError(({ error, set }) => {
			if (hasStatusCodeAndJsonSafe(error)) {
				set.status = error.statusCode;
				return error.toJSONSafe();
			}
		});
}

// ── Helpers ──────────────────────────────────────────────────────────────────

interface Handleable {
	handle(request: Request): Promise<Response> | Response;
}

async function makeRequest(app: Handleable, url: string, method = "GET", ip = "192.168.1.1") {
	const headers: Record<string, string> = {
		"cf-connecting-ip": ip,
	};
	if (method === "POST" || method === "PATCH") {
		headers["Content-Type"] = "application/json";
	}
	return app.handle(
		new Request(`http://localhost${url}`, {
			method,
			headers,
			body: method === "POST" || method === "PATCH" ? "{}" : undefined,
		}),
	);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("rateLimitPlugin integration", () => {
	beforeEach(() => {
		mockRedisInstance.reset();
	});

	it("under-limit requests succeed (200)", async () => {
		const app = createTestApp();
		const res = await makeRequest(app, "/api/v1/products", "GET", "10.0.0.1");
		expect(res.status).toBe(200);
	});

	it("skip function works — /health is not rate-limited", async () => {
		const app = createTestApp();
		const promises = Array.from({ length: 500 }, (_, i) =>
			makeRequest(app, "/health", "GET", "10.0.0.2"),
		);
		const results = await Promise.all(promises);
		for (const res of results) {
			expect(res.status).toBe(200);
		}
	});

	it("hitting the global-ip limit returns 429 with correct body shape", async () => {
		const app = createTestApp();
		const ip = "10.0.0.3";

		const exhaustPromises = Array.from({ length: 301 }, (_, i) =>
			makeRequest(app, "/api/v1/products", "GET", ip),
		);

		const exhaustResults = await Promise.all(exhaustPromises);
		const lastRes = exhaustResults[exhaustResults.length - 1];
		expect(lastRes?.status).toBe(429);

		// Verify JSON body shape matches ErrorResponse
		const body = await lastRes?.json();
		expect(body).toHaveProperty("errId");
		expect(body).toHaveProperty("code", "RATE_LIMITED");
		expect(body).toHaveProperty("message");
		expect(body).toHaveProperty("statusCode", 429);
	});

	it("RateLimit-* headers are present on successful (under-limit) responses", async () => {
		const app = createTestApp();
		const ip = "10.0.0.7";

		const res = await makeRequest(app, "/api/v1/products", "GET", ip);
		expect(res.status).toBe(200);
		expect(res.headers.get("RateLimit-Limit")).not.toBeNull();
		expect(res.headers.get("RateLimit-Remaining")).not.toBeNull();
		expect(res.headers.get("RateLimit-Reset")).not.toBeNull();
	});

	it("window reset — after window passes, requests succeed again", async () => {
		const app = createTestApp();
		const ip = "10.0.0.6";

		// Exhaust
		for (let i = 0; i < 301; i++) {
			await makeRequest(app, "/api/v1/products", "GET", ip);
		}

		// Verify we're blocked
		const blocked = await makeRequest(app, "/api/v1/products", "GET", ip);
		expect(blocked.status).toBe(429);

		// Advance time past the window
		mockRedisInstance.advance(61_000);

		// Now it should work again
		const ok = await makeRequest(app, "/api/v1/products", "GET", ip);
		expect(ok.status).toBe(200);
	});
});

describe("rate limit keys and skip logic", () => {
	it("resolveClientKey returns cf-connecting-ip when present", async () => {
		const { resolveClientKey } = await import("./keys");
		const req = new Request("http://localhost/test", {
			headers: { "cf-connecting-ip": "1.2.3.4" },
		});
		expect(resolveClientKey(req)).toBe("1.2.3.4");
	});

	it("resolveClientKey falls back to x-forwarded-for", async () => {
		const { resolveClientKey } = await import("./keys");
		const req = new Request("http://localhost/test", {
			headers: { "x-forwarded-for": "5.6.7.8, 9.10.11.12" },
		});
		expect(resolveClientKey(req)).toBe("5.6.7.8");
	});

	it("resolveClientKey returns anonymous when no headers", async () => {
		const { resolveClientKey } = await import("./keys");
		const req = new Request("http://localhost/test");
		expect(resolveClientKey(req)).toBe("anonymous");
	});
});

describe("tier configs", () => {
	it("three tiers have different limits", async () => {
		const { globalIpConfig, userStrictConfig, adminStrictConfig } = await import("./config");
		expect(globalIpConfig.max).toBe(300);
		expect(userStrictConfig.max).toBe(30);
		expect(adminStrictConfig.max).toBe(60);
	});
});

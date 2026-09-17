/**
 * Auth configuration contract — locks the security-relevant invariants of the
 * Better Auth setup so a refactor cannot silently disable them.
 */
import { describe, expect, it } from "bun:test";
import { auth } from "@/utils/auth/auth";

describe("auth configuration contract", () => {
	it("keeps Better Auth rate limiting enabled on secondary storage", () => {
		expect(auth.options.rateLimit?.enabled).toBe(true);
		expect(auth.options.rateLimit?.storage).toBe("secondary-storage");
	});

	it("keeps a strict sign-in attempt limit for brute-force protection", () => {
		const signInRule = auth.options.rateLimit?.customRules?.["/sign-in/*"];

		expect(signInRule).toBeDefined();
		expect(signInRule?.max).toBeLessThanOrEqual(10);
	});

	it("keeps the session lifetime at 7 days with daily refresh", () => {
		expect(auth.options.session?.expiresIn).toBe(60 * 60 * 24 * 7);
		expect(auth.options.session?.updateAge).toBe(60 * 60 * 24);
	});

	it("keeps the canonical auth basePath the clients depend on", () => {
		expect(auth.options.basePath).toBe("/api/v1/auth");
	});
});

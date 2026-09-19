import { describe, expect, it } from "bun:test";
import { collectEnvIssues } from "../env";

const BASE = {
	DATABASE_URL: "postgres://localhost/dev",
} as NodeJS.ProcessEnv;

describe("collectEnvIssues", () => {
	it("requires DATABASE_URL in every environment", () => {
		const issues = collectEnvIssues({} as NodeJS.ProcessEnv);
		expect(issues).toContainEqual({ key: "DATABASE_URL", severity: "error" });
	});

	it("does not require production-only keys outside production", () => {
		const issues = collectEnvIssues({ ...BASE, NODE_ENV: "development" });
		const errors = issues.filter((issue) => issue.severity === "error");
		expect(errors).toHaveLength(0);
	});

	it("requires the production keys when NODE_ENV is production", () => {
		const issues = collectEnvIssues({ ...BASE, NODE_ENV: "production" });
		const errorKeys = issues
			.filter((issue) => issue.severity === "error")
			.map((issue) => issue.key);

		expect(errorKeys).toContain("BETTER_AUTH_SECRET");
		expect(errorKeys).toContain("R2_BUCKET_NAME");
		expect(errorKeys).toContain("STORE_URL");
		expect(errorKeys).not.toContain("DATABASE_URL");
	});

	it("passes cleanly when every required production key is present", () => {
		const issues = collectEnvIssues({
			...BASE,
			NODE_ENV: "production",
			BETTER_AUTH_SECRET: "secret",
			R2_ACCOUNT_ID: "id",
			R2_ACCESS_KEY_ID: "key",
			R2_SECRET_ACCESS_KEY: "secret",
			R2_BUCKET_NAME: "bucket",
			R2_PUBLIC_URL: "https://cdn.example.com",
			API_URL: "https://api.example.com",
			ADMIN_URL: "https://admin.example.com",
			STORE_URL: "https://store.example.com",
			LANDING_URL: "https://example.com",
			OPENROUTER_API_KEY: "or",
		});
		expect(issues).toHaveLength(0);
	});

	it("warns (never errors) for optional keys", () => {
		const issues = collectEnvIssues({ ...BASE, NODE_ENV: "development" });
		expect(issues).toContainEqual({ key: "OPENROUTER_API_KEY", severity: "warning" });
	});
});

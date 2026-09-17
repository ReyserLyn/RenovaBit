/**
 * Non-interactive migration runner.
 *
 * Uses the programmatic Drizzle migrator instead of `drizzle-kit migrate` so
 * the deploy pipeline can apply migrations unattended — there is no code path
 * that can prompt, hang or ask questions.
 *
 * Safety rules:
 *   - Refuses to run against a non-local host unless MIGRATE_CONFIRM=yes is
 *     set. The deploy pipeline sets it explicitly; local runs can never touch
 *     production by accident.
 *   - Logs the applied-migration count and exits non-zero on failure, so a
 *     failed deploy is loud and the backup/rollback steps take over.
 *
 * Usage: DATABASE_URL=... bun run scripts/migrate.ts
 */
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error("[migrate] DATABASE_URL is required");
	process.exit(1);
}

let host: string;
try {
	host = new URL(DATABASE_URL).hostname;
} catch {
	console.error("[migrate] DATABASE_URL is not a valid connection string");
	process.exit(1);
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
if (!LOCAL_HOSTS.has(host) && process.env.MIGRATE_CONFIRM !== "yes") {
	console.error(
		`[migrate] Refusing to migrate non-local host "${host}". ` +
			"Set MIGRATE_CONFIRM=yes to apply (the deploy pipeline does it).",
	);
	process.exit(1);
}

const client = postgres(DATABASE_URL, { max: 1, connect_timeout: 15 });
const db = drizzle(client);
const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

async function appliedCount(): Promise<number | null> {
	try {
		const rows = await client<{ count: number }[]>`
			SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations
		`;
		return rows[0]?.count ?? 0;
	} catch {
		return null; // journal table does not exist yet
	}
}

const startedAt = Date.now();
try {
	const before = await appliedCount();
	console.log(`[migrate] host=${host} applied_before=${before === null ? "no-journal" : before}`);

	await migrate(db, { migrationsFolder });

	const after = await appliedCount();
	const applied = before !== null && after !== null ? after - before : "?";
	console.log(`[migrate] applied=${applied} duration_ms=${Date.now() - startedAt}`);
} catch (error) {
	console.error(
		`[migrate] FAILED after ${Date.now() - startedAt}ms: ${error instanceof Error ? error.message : String(error)}`,
	);
	process.exitCode = 1;
} finally {
	await client.end();
}

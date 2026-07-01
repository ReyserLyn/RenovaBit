import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
	throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(DATABASE_URL, {
	max: 20,
	idle_timeout: 30,
	connect_timeout: 10,
	max_lifetime: 3600,
});

export const db = drizzle(client);

/**
 * Close the Postgres connection pool.
 * Should be called during graceful shutdown.
 */
export async function closeDb(): Promise<void> {
	await client.end();
}

import "./relations";

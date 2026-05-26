import { db } from "@renovabit/db";
import { users } from "@renovabit/db/schema";
import { asc } from "drizzle-orm";

// ── Queries ────────────────────────────────────────

async function list() {
	return db
		.select({
			id: users.id,
			name: users.name,
			email: users.email,
			role: users.role,
			image: users.image,
			emailVerified: users.emailVerified,
			username: users.username,
			displayUsername: users.displayUsername,
			phone: users.phone,
			createdAt: users.createdAt,
			updatedAt: users.updatedAt,
		})
		.from(users)
		.orderBy(asc(users.name));
}

// ── Public API ─────────────────────────────────────

export const UserService = {
	list,
};

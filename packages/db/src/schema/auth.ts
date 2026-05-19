import {
	boolean,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { lifecycleDates, primaryKey } from "./_utils";

export const userRoleEnum = pgEnum("user_role", ["admin", "customer", "distributor"]);

export const users = pgTable(
	"users",
	{
		...primaryKey,

		name: varchar("name", { length: 255 }).notNull(),
		email: varchar("email", { length: 255 }).notNull().unique(),
		emailVerified: boolean("email_verified").default(false).notNull(),
		image: text("image"),

		username: varchar("username", { length: 100 }),
		displayUsername: varchar("display_username", { length: 100 }),
		phone: varchar("phone", { length: 20 }),
		role: userRoleEnum("role").default("customer").notNull(),

		banned: boolean("banned").default(false),
		banReason: text("ban_reason"),
		banExpires: timestamp("ban_expires"),

		...lifecycleDates,
	},
	(table) => [index("users_role_idx").on(table.role)],
);

export const sessions = pgTable(
	"sessions",
	{
		...primaryKey,

		expiresAt: timestamp("expires_at").notNull(),
		token: text("token").notNull().unique(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		impersonatedBy: text("impersonated_by"),

		...lifecycleDates,
	},
	(table) => [index("sessions_userId_idx").on(table.userId)],
);

export const accounts = pgTable(
	"accounts",
	{
		...primaryKey,

		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at"),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
		scope: text("scope"),
		password: text("password"),

		...lifecycleDates,
	},
	(table) => [index("accounts_userId_idx").on(table.userId)],
);

export const verifications = pgTable(
	"verifications",
	{
		...primaryKey,

		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at").notNull(),

		...lifecycleDates,
	},
	(table) => [index("verifications_identifier_idx").on(table.identifier)],
);

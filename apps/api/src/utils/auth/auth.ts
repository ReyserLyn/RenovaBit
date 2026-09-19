import { redisStorage } from "@better-auth/redis-storage";
import { db } from "@renovabit/db";
import * as schema from "@renovabit/db/schema";
import { ROLES } from "@renovabit/db/schema";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { admin, openAPI, username } from "better-auth/plugins";
import { count, eq } from "drizzle-orm";
import { appOrigins } from "@/utils/origins";
import { getRedis } from "@/utils/redis";

const isProd = process.env.NODE_ENV === "production";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
	baseURL: process.env.API_URL ?? "http://localhost:3001",
	basePath: "/api/v1/auth",
	secret: process.env.BETTER_AUTH_SECRET,
	trustedOrigins: isProd
		? appOrigins
		: [...appOrigins, "http://localhost:*/**", "https://*.renovabit.com"],
	rateLimit: {
		enabled: true,
		storage: "secondary-storage",
		window: 60,
		max: 100,
		customRules: {
			"/sign-in/*": {
				window: 60,
				max: isProd ? 5 : 10,
			},
			"/sign-up/*": {
				window: 600,
				max: 3,
			},
			"/forget-password": {
				window: 300,
				max: 3,
			},
		},
	},
	database: drizzleAdapter(db, {
		provider: "pg",
		schema,
		usePlural: true,
		camelCase: false,
	}),
	secondaryStorage: redisStorage({
		client: getRedis(),
		keyPrefix: "better-auth:",
	}),
	emailAndPassword: {
		enabled: true,
		autoSignIn: true,
		minPasswordLength: 8,
		maxPasswordLength: 128,
		revokeSessionsOnPasswordReset: true,
		resetPasswordTokenExpiresIn: 60 * 60, // 1 hora
		password: {
			hash: (pass) => Bun.password.hash(pass),
			verify: ({ password, hash }) => Bun.password.verify(password, hash),
		},
	},
	session: {
		expiresIn: 60 * 60 * 24 * 7, // 7 días
		updateAge: 60 * 60 * 24, // 1 día
		storeSessionInDatabase: true,
		cookieCache: {
			enabled: true,
			maxAge: 60, // 1 minuto (mitigación: reduce ventana de cookies stale)
			strategy: "compact",
		},
	},
	advanced: {
		cookiePrefix: "renovabit",
		database: {
			generateId: false,
		},
		crossSubDomainCookies: {
			enabled: true,
			domain: isProd ? "renovabit.com" : "localhost",
		},
		ipAddress: {
			ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
		},
	},
	user: {
		additionalFields: {
			username: {
				type: "string",
				required: false,
				input: true,
			},
			displayUsername: {
				type: "string",
				required: false,
				input: true,
			},
			lastname: {
				type: "string",
				required: false,
				input: true,
			},
			phone: {
				type: "string",
				required: false,
				input: true,
			},
			role: {
				type: [...ROLES],
				required: true,
				index: true,
				defaultValue: "customer",
				input: false,
			},
		},
		deleteUser: {
			enabled: true,
		},
	},
	// Only register the provider when credentials exist: an empty clientId
	// configures Google with broken credentials and fails at sign-in time.
	socialProviders:
		googleClientId && googleClientSecret
			? {
					google: {
						clientId: googleClientId,
						clientSecret: googleClientSecret,
						mapProfileToUser: (profile) => {
							const lastname =
								profile.family_name ??
								(profile.name?.trim().split(/\s+/).slice(1).join(" ") || undefined);
							return { lastname };
						},
					},
				}
			: {},
	hooks: {
		before: createAuthMiddleware(async (ctx) => {
			// Better Auth 1.7.5 blocks self-ban and self-delete, but set-role has no
			// self or last-admin check: the only admin could demote themselves and
			// leave the panel without an owner. Both cases are rejected here.
			if (ctx.path !== "/admin/set-role") return;

			const body = ctx.body as { userId?: string; role?: string | string[] } | undefined;
			const targetId = body?.userId;
			if (!targetId) return;

			const nextRole = Array.isArray(body?.role) ? body.role.join(",") : (body?.role ?? "");
			// Promoting (or anything that keeps admin) is always allowed.
			if (nextRole.split(",").includes("admin")) return;

			if (targetId === ctx.context.session?.user.id) {
				throw new APIError("BAD_REQUEST", {
					message: "No puedes quitarte el rol de administrador a ti mismo.",
				});
			}

			const [target] = await db
				.select({ role: schema.users.role })
				.from(schema.users)
				.where(eq(schema.users.id, targetId))
				.limit(1);

			if (target?.role !== "admin") return;

			const [admins] = await db
				.select({ total: count() })
				.from(schema.users)
				.where(eq(schema.users.role, "admin"));

			if ((admins?.total ?? 0) <= 1) {
				throw new APIError("BAD_REQUEST", {
					message: "No puedes quitarle el rol al único administrador.",
				});
			}
		}),
	},
	plugins: [
		username({
			minUsernameLength: 3,
			maxUsernameLength: 30,
			usernameNormalization: (u) => u.trim().toLowerCase(),
			usernameValidator: (u) => {
				const reserved = [
					"admin",
					"soporte",
					"support",
					"renovabit",
					"moderator",
					"sistema",
					"root",
					"null",
					"undefined",
				];
				return !reserved.includes(u.toLowerCase());
			},
		}),
		admin({
			defaultRole: "customer",
			adminRoles: ["admin"],
			bannedUserMessage:
				"Tu cuenta ha sido suspendida. Si crees que es un error, contáctanos a soporte@renovabit.com",
			defaultBanReason: "Sin razón especificada",
			impersonationSessionDuration: 60 * 15, // 15 min
			defaultBanExpiresIn: 60 * 60 * 24 * 7,
		}),
		// The openAPI schema endpoint (/open-api/generate-schema) would be
		// publicly reachable through the auth catch-all; keep it dev-only like
		// the docs plugin.
		...(isProd ? [] : [openAPI()]),
	],
});

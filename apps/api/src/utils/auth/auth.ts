import { db } from "@renovabit/db";
import * as schema from "@renovabit/db/schema";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { admin, openAPI, username } from "better-auth/plugins";
import { appOrigins } from "@/utils/origins";

const isProd = process.env.NODE_ENV === "production";

export const auth = betterAuth({
	baseURL: process.env.API_URL ?? "http://localhost:3001",
	basePath: "/api/v1/auth",
	secret: process.env.BETTER_AUTH_SECRET,
	trustedOrigins: isProd
		? appOrigins
		: [...appOrigins, "http://localhost:*/**", "https://*.renovabit.com"],
	rateLimit: {
		enabled: isProd,
		window: isProd ? 100 : 150,
		max: 60,
	},
	database: drizzleAdapter(db, {
		provider: "pg",
		schema,
		usePlural: true,
		camelCase: false,
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
			maxAge: 60 * 60, // 1 hora
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
			domain: isProd ? ".renovabit.com" : "localhost",
		},
	},
	user: {
		additionalFields: {
			username: {
				type: "string",
				required: true,
				input: true,
			},
			displayUsername: {
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
				type: ["admin", "customer", "distributor"],
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
		openAPI(),
	],
});

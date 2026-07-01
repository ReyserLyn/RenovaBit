import { Elysia } from "elysia";

// onBeforeHandle (no onAfterHandle) para que los headers también
// aparezcan en respuestas de error.
const isProd = process.env.NODE_ENV === "production";

const BASE_HEADERS: Record<string, string> = {
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY",
	"Referrer-Policy": "no-referrer",
	"Cross-Origin-Resource-Policy": "same-origin",
};

const PROD_HEADERS: Record<string, string> = {
	...BASE_HEADERS,
	"Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

export const SecurityHeadersPlugin = new Elysia({ name: "security-headers" }).onBeforeHandle(
	({ set }) => {
		const headers = isProd ? PROD_HEADERS : BASE_HEADERS;
		for (const [key, value] of Object.entries(headers)) {
			set.headers[key] = value;
		}
	},
);

import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { appOrigins } from "@/utils/origins";

export const CorsPlugin = new Elysia({ name: "cors" }).use(
	cors({
		origin: process.env.NODE_ENV === "production" ? appOrigins : true,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
		exposeHeaders: ["x-retry-after"],
		credentials: true,
		maxAge: 86400,
	}),
);

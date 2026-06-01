import { Elysia } from "elysia";
import { AuthModule } from "@/modules/auth";
import { ChangesModel } from "./changes.model";
import { getRecentChanges } from "./changes.service";

export const changesRoute = new Elysia({ prefix: "/changes" }).use(AuthModule).get(
	"/",
	async ({ query }) => {
		const page = Number.parseInt(query.page ?? "1", 10) || 1;
		const limit = Math.min(Number.parseInt(query.limit ?? "15", 10) || 15, 100);
		const type = query.type || undefined;
		const search = query.search || undefined;

		const result = await getRecentChanges({ page, limit, type, search });

		return {
			changes: result.changes.map((c) => ({
				...c,
				reportStartedAt: c.reportStartedAt?.toISOString() ?? null,
				createdAt: c.createdAt.toISOString(),
			})),
			total: result.total,
		};
	},
	{
		isAdmin: true,
		query: ChangesModel.listQuery,
		response: { 200: ChangesModel.listResponse },
		detail: { summary: "Listar cambios recientes (feed global)", tags: ["Changes"] },
	},
);

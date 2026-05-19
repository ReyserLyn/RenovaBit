/** biome-ignore-all lint/suspicious/noExplicitAny: Documentation Elysia */
import { auth } from "./auth";

// OpenAPI integration
let _schema: ReturnType<typeof auth.api.generateOpenAPISchema>;
const getSchema = async () => (_schema ??= auth.api.generateOpenAPISchema());

export const OpenAPI = {
	getPaths: (prefix = "/api/v1/auth") =>
		getSchema().then(({ paths }) => {
			const reference: any = Object.create(null);

			for (const [path, pathData] of Object.entries(paths)) {
				const key = prefix + path;
				if (!pathData) continue;
				reference[key] = pathData;

				for (const method of Object.keys(pathData)) {
					const operation = (reference[key] as any)[method];

					operation.tags = ["Better Auth"];
				}
			}

			return reference;
		}) as Promise<any>,
	components: getSchema().then(({ components }) => components) as Promise<any>,
} as const;

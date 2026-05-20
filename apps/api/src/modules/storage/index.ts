import { Elysia, t } from "elysia";
import { cleanupPendingObjects } from "@/utils/storage/helpers";
import { ErrorResponse, StorageModel } from "./model";
import { createPresignedUrl } from "./service";

export const storageRoute = new Elysia({ prefix: "/storage" })
	// ── Presigned upload URL ─────────────────────────
	.post("/presign", async ({ body }) => createPresignedUrl(body), {
		isAdmin: true,
		body: StorageModel.presignRequest,
		response: {
			200: StorageModel.presignResponse,
			400: ErrorResponse,
			401: ErrorResponse,
			403: ErrorResponse,
		},
		detail: {
			summary: "Obtener URL de subida directa a R2",
			description:
				"Genera una presigned URL para subir archivos directamente a Cloudflare R2. " +
				"El archivo se sube a una ubicación temporal `pending/` y se mueve a su ubicación " +
				"permanente cuando la entidad (marca, categoría, producto) se crea o actualiza.",
			tags: ["Storage"],
		},
	})

	// ── Garbage collector (pending orphans) ──────────
	.post(
		"/cleanup",
		async ({ body }) => {
			const deletedCount = await cleanupPendingObjects(body.maxAgeHours);
			return { deletedCount };
		},
		{
			isAdmin: true,
			body: t.Object({
				maxAgeHours: t.Optional(t.Number({ minimum: 1, maximum: 168, default: 24 })),
			}),
			response: {
				200: t.Object({ deletedCount: t.Number() }),
				401: ErrorResponse,
				403: ErrorResponse,
			},
			detail: {
				summary: "Limpiar archivos pendientes huérfanos",
				description:
					"Elimina archivos en `pending/` con más de `maxAgeHours` horas de antigüedad. " +
					"Útil para limpiar uploads que nunca se asociaron a una entidad.",
				tags: ["Storage"],
			},
		},
	);

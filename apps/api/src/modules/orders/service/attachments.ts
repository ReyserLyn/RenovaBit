import { ApiError, BackendErrorCodes, createApiError } from "@renovabit/backend-errors";
import { db } from "@renovabit/db";
import { orders } from "@renovabit/db/schema";
import { eq } from "drizzle-orm";
import { MAX_ATTACHMENTS } from "@/constants";
import { logger } from "@/utils/logger";
import {
	deleteEntityAttachment,
	extractKeyFromUrl,
	getPublicUrl,
	isPendingUrl,
	moveObject,
} from "@/utils/storage/helpers";
import type { OrderResponse } from "../model";
import { parseJsonArray } from "./internal";
import { getById } from "./queries";

// ═══════════════════════════════════════════════════
//  ATTACHMENTS
// ═══════════════════════════════════════════════════

async function updateAttachments(orderId: string, urls: string[]): Promise<OrderResponse> {
	const [order] = await db
		.select({ id: orders.id, attachments: orders.attachments })
		.from(orders)
		.where(eq(orders.id, orderId))
		.limit(1);

	if (!order) {
		throw createApiError({
			code: BackendErrorCodes.NOT_FOUND_ERROR,
			message: "Pedido no encontrado",
			logLevel: "info",
			doNotLog: true,
		});
	}

	if (urls.length > MAX_ATTACHMENTS) {
		throw createApiError({
			code: BackendErrorCodes.INPUT_VALIDATION_ERROR,
			message: `Máximo ${MAX_ATTACHMENTS} adjuntos permitidos`,
			logLevel: "info",
			doNotLog: true,
		});
	}

	const current = parseJsonArray(order.attachments);
	const uniqueUrls = [...new Set(urls)];
	const removed = current.filter((url) => !uniqueUrls.includes(url));

	// Step 1: persist the new list first (with pending URLs still in place).
	// If this fails, no objects have been moved yet — no orphaned storage.
	await db
		.update(orders)
		.set({ attachments: uniqueUrls, updatedAt: new Date() })
		.where(eq(orders.id, orderId));

	// Step 2: move pending objects to permanent location. Errors here are
	// non-fatal: the DB already has the pending URLs, which are still valid
	// references to the temporary objects.
	const resolved = await Promise.all(
		uniqueUrls.map(async (url) => {
			if (!isPendingUrl(url)) return url;

			const key = extractKeyFromUrl(url);
			if (!key) return url;

			const filename = key.split("/").pop() || key;
			const permanentKey = `orders/${orderId}/${filename}`;

			try {
				await moveObject(key, permanentKey);
				return getPublicUrl(permanentKey);
			} catch (error) {
				// Client errors (e.g. an oversize upload rejected by moveObject) must
				// reach the caller; only genuine storage hiccups degrade to keeping
				// the pending URL.
				if (error instanceof ApiError) throw error;
				logger
					.withError(error)
					.withMetadata({ orderId, url })
					.warn("[Orders] No se pudo resolver adjunto pendiente");
				return url;
			}
		}),
	);

	// Step 3: update DB with resolved permanent URLs. The objects are now
	// safely in their permanent location regardless of this update outcome.
	await db
		.update(orders)
		.set({ attachments: resolved, updatedAt: new Date() })
		.where(eq(orders.id, orderId));

	// Step 4: clean up removed attachments.
	await Promise.all(removed.map((url) => deleteEntityAttachment(url)));
	const updated = await getById(orderId, true);

	if (!updated) {
		throw createApiError({
			code: BackendErrorCodes.INTERNAL_SERVER_ERROR,
			message: "Error al actualizar adjuntos",
		});
	}

	return updated;
}

export { updateAttachments };

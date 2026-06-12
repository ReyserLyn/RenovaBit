import { logger } from "@/utils/logger";
import { createQueue } from "@/utils/queue";

/**
 * Cola de mantenimiento de pedidos.
 *
 * Auto-cancel de pedidos `pending` que superen `AUTO_CANCEL_MS`:
 * - **Primario**: job delayed por orden, programado en `OrderService.create()`.
 *   Dispara EXACTAMENTE al cumplirse el plazo. Se cancela con `removeOrderAutoCancel`
 *   cuando el admin confirma/cancela/refunda antes.
 * - **Safety net**: cron diario que llama a `OrderService.autoCancelExpiredPending()`
 *   para cubrir pedidos que perdieron su job (ej. Redis cayó entre create y el plazo).
 */
export const ordersQueue = createQueue("orders", {
	defaultJobOptions: {
		attempts: 3,
		backoff: { type: "exponential", delay: 5_000 },
		removeOnComplete: 200,
		removeOnFail: 500,
	},
});

const AUTO_CANCEL_JOB_ID_PREFIX = "auto-cancel:order:";
const SAFETY_NET_JOB_KEY = "orders:auto-cancel-safety-net";

/** Stable jobId para que `getJob` + `remove` sean deterministas. */
function autoCancelJobId(orderId: string): string {
	return `${AUTO_CANCEL_JOB_ID_PREFIX}${orderId}`;
}

/**
 * Programa el auto-cancel de una orden. El `jobId` estable hace que un
 * segundo add para la misma orden sea no-op (idempotente).
 */
export async function enqueueOrderAutoCancel(orderId: string, delayMs: number): Promise<void> {
	await ordersQueue.add(
		"auto-cancel",
		{ orderId },
		{
			jobId: autoCancelJobId(orderId),
			delay: delayMs,
		},
	);
}

/**
 * Cancela el auto-cancel programado. Si el job no existe, no hace nada.
 * Si falla (ej. Redis cae), el worker es idempotente y no-op cuando dispare.
 */
export async function removeOrderAutoCancel(orderId: string): Promise<void> {
	const job = await ordersQueue.getJob(autoCancelJobId(orderId));
	await job?.remove();
}

// ── Safety net diario: cubre jobs perdidos (ej. Redis cayó entre create y el plazo) ──
// `.catch` porque es un module-level promise; unhandled rejection crashea el proceso.
ordersQueue
	.add(
		"safety-net",
		{},
		{
			repeat: { pattern: "0 3 * * *", tz: "America/Lima", key: SAFETY_NET_JOB_KEY },
			removeOnComplete: 30,
			removeOnFail: 100,
		},
	)
	.catch((error) => {
		logger.withError(error).warn("[OrdersQueue] failed to schedule safety-net job");
	});

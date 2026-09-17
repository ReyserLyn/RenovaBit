import { updateAttachments } from "./attachments";
import { create } from "./create";
import { getById, listAdmin, listByUser } from "./queries";
import {
	autoCancelExpiredPending,
	batchUpdate,
	cancelByUser,
	cancelIfStillPending,
	updateStatus,
} from "./status";

/**
 * Public order service surface. The implementation is split by concern:
 *
 * - `create`      — checkout flow (idempotent replay, stock, pricing snapshot)
 * - `queries`     — response builder, detail and list reads
 * - `status`      — transitions, user cancel, auto-cancel, batch
 * - `attachments` — payment proof attachment lifecycle
 */
export const OrderService = {
	create,
	getById,
	listByUser,
	listAdmin,
	updateStatus,
	updateAttachments,
	cancelByUser,
	batchUpdate,
	cancelIfStillPending,
	autoCancelExpiredPending,
};

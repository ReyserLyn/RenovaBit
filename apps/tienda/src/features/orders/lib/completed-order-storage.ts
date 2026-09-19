/**
 * Last completed guest checkout, persisted so the success panel (order number,
 * total, WhatsApp CTA) survives a page refresh. Guests have no account to look
 * the order up, so this is the only client-side record they keep.
 *
 * Only the fields the panel needs are stored — no personal data beyond the
 * customer name the checkout already collected.
 */

const STORAGE_KEY = "renovabit-completed-order";

export interface CompletedOrderInfo {
	id: string;
	orderNumber: string;
	total: string;
	customerName?: string | null;
	/** Epoch ms — used to expire stale records. */
	savedAt: number;
}

/** A day is long enough to cover a refresh/reconnect, short enough to expire. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function isCompletedOrderInfo(value: unknown): value is CompletedOrderInfo {
	if (!value || typeof value !== "object") return false;
	const record = value as Record<string, unknown>;
	return (
		typeof record.id === "string" &&
		typeof record.orderNumber === "string" &&
		typeof record.total === "string" &&
		typeof record.savedAt === "number"
	);
}

/** Reads the persisted order, returning null when absent, corrupt or stale. */
export function readCompletedOrder(): CompletedOrderInfo | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		if (!isCompletedOrderInfo(parsed)) {
			window.localStorage.removeItem(STORAGE_KEY);
			return null;
		}
		if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
			window.localStorage.removeItem(STORAGE_KEY);
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export function saveCompletedOrder(order: Omit<CompletedOrderInfo, "savedAt">): void {
	if (typeof window === "undefined") return;
	try {
		const payload: CompletedOrderInfo = { ...order, savedAt: Date.now() };
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
	} catch {
		// Storage can be unavailable (private mode/quota); the panel still works
		// for the current render, it just won't survive a refresh.
	}
}

export function clearCompletedOrder(): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.removeItem(STORAGE_KEY);
	} catch {
		// Ignore storage errors.
	}
}

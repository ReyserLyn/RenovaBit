/**
 * UI labels and URL helpers for orders.
 *
 * Separated from `orders.ts` because `@renovabit/db` is the schema layer —
 * presentation strings like i18n labels are not schema concerns.
 *
 * Types are imported from `orders.ts` to keep a single source of truth.
 */

import type { OrderSource, OrderStatus, PaymentMethod } from "./orders";

// ── Order status labels ───────────────────────────────

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
	pending: "Pendiente",
	confirmed: "Confirmado",
	cancelled: "Cancelado",
	refunded: "Reembolsado",
};

/** Slugified ORDER_STATUS_LABELS for use in URLs (nuqs parseAsStringLiteral). */
export const ORDER_STATUS_URL_VALUES = [
	"pendiente",
	"confirmado",
	"cancelado",
	"reembolsado",
] as const;

export type StatusUrl = (typeof ORDER_STATUS_URL_VALUES)[number];

// ── Payment method labels ──────────────────────────────

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
	cash: "Efectivo",
	transfer: "Transferencia",
	yape: "Yape",
	plin: "Plin",
};

/** Slugified PAYMENT_METHOD_LABELS for use in URLs (nuqs parseAsStringLiteral). */
export const PAYMENT_METHOD_URL_VALUES = ["efectivo", "transferencia", "yape", "plin"] as const;

export type PaymentUrl = (typeof PAYMENT_METHOD_URL_VALUES)[number];

// ── Order source labels ────────────────────────────────

export const SOURCE_LABELS: Record<OrderSource, string> = {
	web: "Web",
	whatsapp: "WhatsApp",
};

// ── URL slug ↔ API value mappings (nuqs-friendly) ─────

export const STATUS_URL_TO_API: Record<StatusUrl, OrderStatus> = {
	pendiente: "pending",
	confirmado: "confirmed",
	cancelado: "cancelled",
	reembolsado: "refunded",
};

export const PAYMENT_URL_TO_API: Record<PaymentUrl, PaymentMethod> = {
	efectivo: "cash",
	transferencia: "transfer",
	yape: "yape",
	plin: "plin",
};

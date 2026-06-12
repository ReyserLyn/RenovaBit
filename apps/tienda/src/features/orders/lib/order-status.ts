import { PAYMENT_METHOD_OPTIONS } from "./payment-methods";

/**
 * Configuración de presentación para los estados de pedido.
 * Centralizada para que admin, tienda, y emails usen la misma UI.
 */
export const ORDER_STATUS_CONFIG = {
	pending: { label: "Pendiente", variant: "warning" as const, tone: "warning" },
	confirmed: { label: "Confirmado", variant: "success" as const, tone: "success" },
	cancelled: { label: "Cancelado", variant: "destructive" as const, tone: "destructive" },
	refunded: { label: "Reembolsado", variant: "info" as const, tone: "info" },
} as const;

export type OrderStatus = keyof typeof ORDER_STATUS_CONFIG;

export function getOrderStatusInfo(status: string) {
	return (
		ORDER_STATUS_CONFIG[status as OrderStatus] ?? {
			label: status,
			variant: "outline" as const,
			tone: "muted" as const,
		}
	);
}

/**
 * Días que un pedido `pending` permanece antes de auto-cancelarse.
 * Debe coincidir con `AUTO_CANCEL_MS` en el backend.
 */
export const AUTO_CANCEL_DAYS = 2;

/**
 * Mapa de método de pago → label en español.
 * Mantiene paridad con `PAYMENT_METHOD_OPTIONS` (mismos value).
 */
const PAYMENT_METHOD_LABELS = Object.fromEntries(
	(PAYMENT_METHOD_OPTIONS as readonly { value: string; label: string }[]).map((opt) => [
		opt.value,
		opt.label,
	]),
) as Record<(typeof PAYMENT_METHOD_OPTIONS)[number]["value"], string>;

export function getPaymentMethodLabel(value: string | null | undefined): string {
	if (!value) return "Sin especificar";
	return PAYMENT_METHOD_LABELS[value as keyof typeof PAYMENT_METHOD_LABELS] ?? value;
}

export const SOURCE_LABELS: Record<string, string> = {
	web: "Web",
	whatsapp: "WhatsApp",
};

export function getSourceLabel(value: string | null | undefined): string {
	if (!value) return "—";
	return SOURCE_LABELS[value] ?? value;
}

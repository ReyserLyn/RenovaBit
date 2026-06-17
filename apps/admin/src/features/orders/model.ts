import {
	ORDER_SOURCES,
	ORDER_STATUS_LABELS,
	ORDER_STATUS_TRANSITIONS,
	ORDER_STATUSES,
	type OrderSource,
	type OrderStatus,
	PAYMENT_METHOD_LABELS,
	type PAYMENT_METHODS,
	SOURCE_LABELS,
} from "@renovabit/db/orders";
import { z } from "zod";

// ── Constants ────────────────────────────────────────────

type OrderStatusConfig = Record<
	OrderStatus,
	{
		label: string;
		variant: "invert-light" | "success" | "destructive" | "info";
	}
>;

export const ORDER_STATUS_CONFIG: OrderStatusConfig = {
	pending: { label: ORDER_STATUS_LABELS.pending, variant: "invert-light" },
	confirmed: { label: ORDER_STATUS_LABELS.confirmed, variant: "success" },
	cancelled: { label: ORDER_STATUS_LABELS.cancelled, variant: "destructive" },
	refunded: { label: ORDER_STATUS_LABELS.refunded, variant: "info" },
};

export { PAYMENT_METHOD_LABELS, SOURCE_LABELS };

export const VALID_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> =
	ORDER_STATUS_TRANSITIONS;

export const STATUS_CHANGE_LABEL: Record<string, string> = {
	confirmed: "Confirmar pedido",
	cancelled: "Cancelar pedido",
	refunded: "Reembolsar pedido",
};

// ── Domain Types ────────────────────────────────────────

export type { OrderSource, OrderStatus };

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface OrderItem {
	id: string;
	productId: string | null;
	productName: string;
	productSku: string;
	productSlug: string | null;
	quantity: number;
	unitPrice: string;
	finalPrice: string;
}

export interface OrderListItem {
	id: string;
	orderNumber: string;
	status: OrderStatus;
	source: OrderSource;
	total: string;
	itemsCount: number;
	customerName: string | null;
	createdAt: string;
}

export interface OrderListResponse {
	orders: OrderListItem[];
	total: number;
}

export interface OrderDetail {
	id: string;
	userId: string | null;
	orderNumber: string;
	status: OrderStatus;
	source: OrderSource;
	paymentMethod: PaymentMethod | null;
	paymentProofUrl: string | null;
	customerName: string | null;
	customerPhone: string | null;
	customerEmail: string | null;
	subtotal: string;
	discountTotal: string;
	total: string;
	notes: string | null;
	adminNotes: string | null;
	items: OrderItem[];
	createdAt: string;
	confirmedAt: string | null;
	cancelledAt: string | null;
	cancelReason: string | null;
	attachments: string[];
}

// ── Zod Schemas ─────────────────────────────────────────

export const updateOrderStatusSchema = z.object({
	status: z.enum(ORDER_STATUSES, {
		error: "Estado no válido",
	}),
	adminNotes: z.string().max(2000, { error: "Máximo 2000 caracteres" }).optional(),
	cancelReason: z.string().max(500, { error: "Máximo 500 caracteres" }).optional(),
});

export interface BatchActionResult {
	succeeded: string[];
	failed: Array<{ id: string; reason: string }>;
}

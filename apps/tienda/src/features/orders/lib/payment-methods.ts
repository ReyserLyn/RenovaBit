export const PAYMENT_METHOD_OPTIONS = [
	{ value: "yape", label: "Yape" },
	{ value: "plin", label: "Plin" },
	{ value: "transfer", label: "Transferencia o depósito" },
	{ value: "cash", label: "Efectivo" },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHOD_OPTIONS)[number]["value"];

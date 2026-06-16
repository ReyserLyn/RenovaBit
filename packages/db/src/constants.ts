/** Días que un pedido `pending` permanece antes de auto-cancelarse. */
export const AUTO_CANCEL_DAYS = 2;

/** Milisegundos que un pedido `pending` permanece antes de auto-cancelarse. */
export const AUTO_CANCEL_MS = AUTO_CANCEL_DAYS * 24 * 60 * 60 * 1000; // 2 días

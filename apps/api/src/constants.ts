/**
 * Application-wide constants. Single source of truth.
 * Import from this file instead of duplicating magic numbers.
 */

// ── Pagination ──────────────────────────────────────
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ── Bulk operations ────────────────────────────────
export const MAX_BULK_DELETE = 50;

// ── File uploads ────────────────────────────────────
export const MAX_ATTACHMENTS = 10;

// ── Orders ──────────────────────────────────────────
export const MAX_PENDING_ORDERS = 10;
/** Pending-order cap for guests, keyed by canonical customer phone. */
export const MAX_PENDING_GUEST_ORDERS = 5;
export const MAX_ORDER_NUMBER_RETRIES = 5;

// ── Provider feed sanity ────────────────────────────
/**
 * Ceiling for a supplier price coming from the scrape. Values above it are
 * feed anomalies (the page has been seen reporting 10M/100M) and are skipped
 * instead of being imported as a real price.
 */
export const MAX_FEED_SUPPLIER_PRICE = 50_000;

/**
 * Ventana de gracia durante la cual un pedido `confirmed` sigue reteniendo
 * stock mientras el feed del proveedor refleja la compra (ver utils/stock.ts).
 * Ajustar según el lag real observado: si las compras al proveedor demoran más
 * en reflejarse, subir este valor.
 */
export const CONFIRMED_HOLD_HOURS = 4;
export const CONFIRMED_HOLD_SECONDS = CONFIRMED_HOLD_HOURS * 60 * 60;

// ── Search ──────────────────────────────────────────
export const SLOW_QUERY_THRESHOLD_MS = 200;
export const SEARCH_MAX_LENGTH = 100;
export const SEARCH_PAYLOAD_CAP = 256;

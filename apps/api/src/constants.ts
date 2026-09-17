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
export const MAX_ORDER_NUMBER_RETRIES = 5;

// ── Search ──────────────────────────────────────────
export const SLOW_QUERY_THRESHOLD_MS = 200;
export const SEARCH_MAX_LENGTH = 100;
export const SEARCH_PAYLOAD_CAP = 256;

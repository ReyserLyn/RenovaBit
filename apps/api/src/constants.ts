/**
 * Application-wide constants. Single source of truth.
 * Import from this file instead of duplicating magic numbers.
 */

// ── Pagination ──────────────────────────────────────
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MAX_FILTER_OFFSET = 10000;

// ── Bulk operations ────────────────────────────────
export const MAX_BULK_DELETE = 50;

// ── File uploads ────────────────────────────────────
export const MAX_ATTACHMENTS = 10;
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

// ── Margins / pricing ──────────────────────────────
export const CUSTOM_MARGIN_PERCENT_MAX = 1000;
export const DEFAULT_DISTRIBUTOR_TIER_MARGIN_PERCENT = 10;
export const DEFAULT_CUSTOMER_TIER_MARGIN_PERCENT = 15;

// ── Orders ──────────────────────────────────────────
export const MAX_PENDING_ORDERS = 10;
export const MAX_ORDER_NUMBER_RETRIES = 5;

// ── Search ──────────────────────────────────────────
export const SLOW_QUERY_THRESHOLD_MS = 200;
export const SEARCH_MAX_LENGTH = 100;
export const SEARCH_PAYLOAD_CAP = 256;

// ── Auth (time/limit values) ───────────────────────
export const AUTH_MAGIC_NUMBERS = {
	/** Session TTL (7 days) */
	SESSION_MAX_AGE_SECONDS: 7 * 24 * 60 * 60,
	/** Session update age (1 day) — how often the session is refreshed */
	SESSION_UPDATE_AGE_SECONDS: 24 * 60 * 60,
	/** Cookie cache TTL (1 hour) */
	SESSION_COOKIE_CACHE_MAX_AGE_SECONDS: 60 * 60,
	/** Rate limit window (10 seconds) */
	RATE_LIMIT_WINDOW_SECONDS: 10,
	/** Max requests per rate limit window */
	RATE_LIMIT_MAX_REQUESTS: 10,
	/** Admin impersonation session max duration (15 min) */
	IMPERSONATION_MAX_DURATION_SECONDS: 15 * 60,
	/** Ban default duration (7 days) */
	BAN_DEFAULT_DURATION_SECONDS: 7 * 24 * 60 * 60,
	/** Password min length */
	PASSWORD_MIN_LENGTH: 8,
	/** Password max length */
	PASSWORD_MAX_LENGTH: 128,
	/** Verification token expiry (1 hour) */
	VERIFICATION_TOKEN_EXPIRY_SECONDS: 60 * 60,
} as const;

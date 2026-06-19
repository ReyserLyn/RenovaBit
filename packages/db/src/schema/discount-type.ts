import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Discount type enum — only `percentage` is supported.
 * `fixed_amount` was removed in the simplified offers model.
 */
export const DISCOUNT_TYPES = ["percentage"] as const;

export const discountTypeEnum = pgEnum("discount_type", DISCOUNT_TYPES);

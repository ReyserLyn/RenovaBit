import { pgEnum } from "drizzle-orm/pg-core";

export const DISCOUNT_TYPES = ["percentage", "fixed_amount"] as const;

export const discountTypeEnum = pgEnum("discount_type", DISCOUNT_TYPES);

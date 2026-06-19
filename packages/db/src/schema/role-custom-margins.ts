/**
 * Per-role custom margin overrides for a product.
 * Mirrors the shape of `products.roleCustomMargins` JSONB column.
 *
 * When set, the `enabled: true` variant wins over tier-based rules for that role.
 * The DB column is JSONB `$type<>()`-narrowed to this exact shape so any
 * unknown role or extra key is a compile error.
 */
export type RoleCustomMargins = {
	customer?: { enabled: true; percent: string };
	distributor?: { enabled: true; percent: string };
};

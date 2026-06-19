/**
 * Rounds a currency value to 2 decimal places using standard Math.round (half-up).
 *
 * This is the SINGLE rounding policy for all price math in the pricing engine.
 * Never use `toFixed()` for arithmetic — it returns a string and can introduce
 * rounding bias. Use `toFixed()` only for display/formatting at the API boundary.
 *
 * @param value - A monetary value (possibly with floating-point noise)
 * @returns The value rounded to 2 decimal places
 *
 * @example
 * roundCurrency(28.330000000000002) // → 28.33
 * roundCurrency(28.335)             // → 28.34  (half-up via Math.round)
 */
export function roundCurrency(value: number): number {
	return Math.round(value * 100) / 100;
}

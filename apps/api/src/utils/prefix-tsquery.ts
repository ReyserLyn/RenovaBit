/**
 * Build a prefix-aware tsquery string for partial word matching.
 * Each token is sanitized and converted to prefix form (token:*).
 * Tokens are AND-combined so all must match.
 *
 * Example: "3200" → "3200:*" which matches "3200MHz", "3200DPI", etc.
 */
export function buildPrefixTsQuery(input: string): string {
	const trimmed = input.trim();
	// Strip characters that would break to_tsquery syntax
	const sanitized = trimmed.replace(/[\\&|!():*<>]/g, " ").trim();
	const tokens = sanitized.split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return "";
	return tokens.map((token) => `${token}:*`).join(" & ");
}

/**
 * Escape LIKE wildcards (% and _) and the escape character itself (\) in user input
 * so they are treated as literals in ILIKE patterns.
 */
export function escapeLikePattern(input: string): string {
	return input.replace(/[\\%_]/g, "\\$&");
}

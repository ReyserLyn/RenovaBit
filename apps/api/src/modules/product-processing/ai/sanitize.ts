/**
 * Sanitizing for untrusted supplier strings.
 *
 * The raw product name comes from a third-party supplier page and is embedded
 * in the extraction prompt, so it must be bounded before it reaches the model:
 * control characters stripped, whitespace collapsed and length capped. That
 * keeps a hostile or broken feed from inflating the request or smuggling
 * instructions through invisible characters.
 */

/** Maximum length of the raw name sent to the model. */
export const RAW_NAME_MAX = 500;

// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional — strips control chars from untrusted supplier input
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F-\u009F]/g;

export function sanitizeRawName(rawName: string): string {
	return rawName.replace(CONTROL_CHARS_RE, " ").replace(/\s+/g, " ").trim().slice(0, RAW_NAME_MAX);
}

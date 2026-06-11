import qs from "query-string";

export function parseSearch(searchStr: string): Record<string, unknown> {
	const parsed = qs.parse(searchStr, {
		arrayFormat: "comma",
		parseBooleans: false,
		parseNumbers: false,
	});

	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(parsed)) {
		out[key] = Array.isArray(value) ? value.join(",") : value;
	}
	return out;
}

export function stringifySearch(search: Record<string, unknown>): string {
	const serialized = qs.stringify(search, {
		arrayFormat: "comma",
		skipEmptyString: true,
		skipNull: true,
		sort: (a, b) => a.localeCompare(b),
	});

	return serialized ? `?${serialized}` : "";
}

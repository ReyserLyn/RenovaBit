import { getRequestHeaders } from "@tanstack/react-start/server";
import { getApiBaseUrl } from "@/shared/lib/env";

function parseErrorCode(body: unknown): string | undefined {
	if (typeof body !== "object" || body === null) return;
	if (!("code" in body)) return;
	const code = (body as Record<string, unknown>).code;
	return typeof code === "string" ? code : undefined;
}

interface SsrFetchResult<T> {
	data: T | null;
	errorCode?: string;
}

export async function ssrFetch<T>(path: string): Promise<SsrFetchResult<T>> {
	try {
		const apiUrl = getApiBaseUrl();
		const reqHeaders = getRequestHeaders();
		const cookie = reqHeaders.get("cookie") ?? "";

		const response = await fetch(`${apiUrl}${path}`, {
			headers: { cookie },
			cache: "no-store",
		});

		if (!response.ok) {
			const body: unknown = await response.json().catch(() => undefined);
			return { data: null, errorCode: parseErrorCode(body) };
		}

		const json: unknown = await response.json();
		if (!json || typeof json !== "object") return { data: null };
		return { data: json as T };
	} catch {
		return { data: null };
	}
}

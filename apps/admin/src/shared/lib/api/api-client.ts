import { type ApiClient, createApiClient } from "@renovabit/backend-client";

function getApiBaseUrl(): string {
	return import.meta.env.VITE_API_URL ?? process.env.VITE_API_URL ?? "http://localhost:3001";
}

export const api: ApiClient = createApiClient(getApiBaseUrl());

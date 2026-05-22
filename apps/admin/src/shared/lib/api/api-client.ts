import { type ApiClient, createApiClient } from "@renovabit/backend-client";

function getApiBaseUrl(): string {
	return process.env.VITE_API_URL ?? "http://localhost:3001";
}

export const api: ApiClient = createApiClient(getApiBaseUrl());

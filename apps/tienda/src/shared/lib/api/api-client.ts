import { type ApiClient, createApiClient } from "@renovabit/backend-client";
import { getApiBaseUrl } from "@/shared/lib/env";

export const api: ApiClient = createApiClient(getApiBaseUrl());

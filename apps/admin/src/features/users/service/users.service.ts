import { api } from "@/shared/lib/api/api-client";
import { unwrapResponse } from "@/shared/lib/api/api-errors";
import type { UserSummary } from "../model";

async function list(): Promise<UserSummary[]> {
	return unwrapResponse(api.api.v1.users.get());
}

export const usersService = {
	list,
};

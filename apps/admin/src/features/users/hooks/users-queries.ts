import { queryOptions, useQuery } from "@tanstack/react-query";
import { usersService } from "../service/users.service";

// ── Query Key Factory ──────────────────────────────────

export const userKeys = {
	all: ["users"] as const,
	lists: () => [...userKeys.all, "list"] as const,
};

// ── Query Options ──────────────────────────────────────

export const usersQueryOptions = queryOptions({
	queryKey: userKeys.lists(),
	queryFn: () => usersService.list(),
	staleTime: 1000 * 60 * 10, // 10 min — los usuarios no cambian frecuentemente
});

// ── Queries ────────────────────────────────────────────

export function useUsers() {
	return useQuery(usersQueryOptions);
}

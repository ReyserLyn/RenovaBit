import { Elysia } from "elysia";
import { ErrorResponse, UserModel } from "./model";
import { UserService } from "./service";

// ── Routes ─────────────────────────────────────────

export const usersRoute = new Elysia({ prefix: "/users" })
	// ── List ────────────────────────────────────────
	.get(
		"/",
		async () => {
			return UserService.list();
		},
		{
			isAdmin: true,
			response: {
				200: UserModel.userListResponse,
				401: ErrorResponse,
				403: ErrorResponse,
			},
			detail: { summary: "Listar usuarios (admin)", tags: ["Users"] },
		},
	);

import { Elysia } from "elysia";
import { AuthMacros } from "@/modules/auth";
import { ErrorResponse, UserModel } from "./model";
import { UserService } from "./service";

// ═══════════════════════════════════════════════════
//  ADMIN — requiere isAdmin macro
//  Prefijo: /api/v1/admin/users
//
//  Only the admin-only routes live here. The `/me` routes are user-scoped and
//  are mounted exclusively on the public router (see ./index.ts), so no
//  isAuth-only handler ever leaks under /api/v1/admin.
// ═══════════════════════════════════════════════════

export const adminUsersRoute = new Elysia({ prefix: "/users" })
	.use(AuthMacros)
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

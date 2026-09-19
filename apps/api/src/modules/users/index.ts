import { Elysia } from "elysia";
import { AuthMacros } from "@/modules/auth";
import { ErrorResponse, UserModel } from "./model";
import { type UpdateProfileInput, UserService } from "./service";

// ── Routes (public, user-scoped) ───────────────────
//
// Only the `/me` routes live here. Admin-only routes (the user list) live in
// ./admin.ts and are mounted exclusively inside the admin router, so no
// isAuth-only handler is ever reachable under `/api/v1/admin`.

export const usersRoute = new Elysia({ prefix: "/users" })
	.use(AuthMacros)
	// ── Get own profile ─────────────────────────────
	.get(
		"/me",
		async ({ user }) => {
			const profile = await UserService.getProfile(user.id);
			return profile;
		},
		{
			isAuth: true,
			response: {
				200: UserModel.userProfile,
				401: ErrorResponse,
			},
			detail: { summary: "Obtener perfil propio", tags: ["Users"] },
		},
	)
	// ── Update own profile ──────────────────────────
	.patch(
		"/me",
		async ({ body, user, request: { headers } }) => {
			const input: UpdateProfileInput = {
				name: body.name,
				lastname: body.lastname === "" ? null : body.lastname,
				username: body.username === "" ? null : body.username,
				displayUsername: body.displayUsername === "" ? null : body.displayUsername,
				phone: body.phone === "" ? null : body.phone,
				image: body.image ?? null,
				removeImage: body.removeImage === "true",
			};

			return UserService.updateProfile(user.id, input, headers);
		},
		{
			isAuth: true,
			type: "formdata",
			body: UserModel.updateProfileBody,
			response: {
				200: UserModel.userProfile,
				401: ErrorResponse,
				409: ErrorResponse,
			},
			detail: { summary: "Actualizar perfil propio", tags: ["Users"] },
		},
	);

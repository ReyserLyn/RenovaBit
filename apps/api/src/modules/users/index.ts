import { Elysia } from "elysia";
import { AuthModule } from "@/modules/auth";
import { ErrorResponse, UserModel } from "./model";
import { type UpdateProfileInput, UsernameConflictError, UserService } from "./service";

// ── Routes ─────────────────────────────────────────

export const usersRoute = new Elysia({ prefix: "/users" })
	.use(AuthModule)
	// ── List (admin) ────────────────────────────────
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
	)
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
			},
			error({ error, set }) {
				if (error instanceof UsernameConflictError) {
					set.status = 409;
					return {
						errId: "",
						code: "CONFLICT",
						message: error.message,
						statusCode: 409,
						metadata: { field: "displayUsername" },
					};
				}
				// Let other errors propagate to the global error handler
			},
			detail: { summary: "Actualizar perfil propio", tags: ["Users"] },
		},
	);

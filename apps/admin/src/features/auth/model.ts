import { z } from "zod";

export const loginSchema = z.object({
	emailOrUsername: z
		.string()
		.trim()
		.min(1, { error: "El correo o usuario es obligatorio." })
		.max(100, {
			error: "El correo o usuario no puede superar 100 caracteres.",
		}),
	password: z
		.string()
		.trim()
		.min(8, {
			error: "La contraseña debe tener al menos 8 caracteres.",
		})
		.max(128, {
			error: "La contraseña no puede superar 128 caracteres.",
		}),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

import { z } from "zod";

// ── Login ────────────────────────────────────────────

export const loginSchema = z.object({
	emailOrUsername: z
		.string()
		.trim()
		.min(1, "El correo o usuario es obligatorio.")
		.max(100, "El correo o usuario no puede superar 100 caracteres."),
	password: z
		.string()
		.trim()
		.min(8, "La contraseña debe tener al menos 8 caracteres.")
		.max(128, "La contraseña no puede superar 128 caracteres."),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

// ── Register: Step 1 (Datos personales + acceso) ─────

export const step1Schema = z.object({
	name: z.string().min(1, "El nombre es requerido."),
	lastname: z.string().min(1, "El apellido es requerido."),
	phone: z
		.string()
		.regex(/^\d{9}$/, "Debe tener exactamente 9 dígitos.")
		.or(z.literal("")),
	email: z.string().email("Correo electrónico inválido."),
	username: z
		.string()
		.trim()
		.min(3, "Debe tener al menos 3 caracteres.")
		.max(30, "No puede superar 30 caracteres.")
		.toLowerCase()
		.or(z.literal("")),
});

export type Step1Values = z.infer<typeof step1Schema>;

// ── Register: Step 2 (Contraseña) ────────────────────

const passwordSchema = z
	.string()
	.min(8, "La contraseña debe tener al menos 8 caracteres.")
	.max(128, "La contraseña no puede superar 128 caracteres.")
	.regex(/(?=.*\d)/, "La contraseña debe tener al menos un dígito.");

export const step2Schema = z
	.object({
		password: passwordSchema,
		confirmPassword: z.string(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Las contraseñas no coinciden.",
		path: ["confirmPassword"],
	});

export type Step2Values = z.infer<typeof step2Schema>;

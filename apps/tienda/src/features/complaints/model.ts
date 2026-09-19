import { z } from "zod";

/**
 * Mirrors `CreateComplaintBody` in the API so the client blocks invalid input
 * before the round-trip. The API stays the source of truth.
 */
export const complaintSchema = z
	.object({
		type: z.enum(["reclamo", "queja"], {
			message: "Selecciona si es un reclamo o una queja.",
		}),
		fullName: z
			.string()
			.trim()
			.min(3, "Ingresa tu nombre completo (mínimo 3 caracteres).")
			.max(255, "El nombre no puede superar 255 caracteres."),
		docType: z.enum(["DNI", "CE", "RUC", "PASAPORTE"], {
			message: "Selecciona el tipo de documento.",
		}),
		docNumber: z
			.string()
			.trim()
			.min(4, "El número de documento debe tener al menos 4 caracteres.")
			.max(20, "El número de documento no puede superar 20 caracteres.")
			.regex(/^[A-Za-z0-9-]+$/, "Solo se permiten letras, números y guiones."),
		email: z
			.string()
			.trim()
			.email("Ingresa un correo electrónico válido.")
			.max(255, "El correo no puede superar 255 caracteres."),
		phone: z
			.string()
			.trim()
			.min(6, "Ingresa un teléfono válido.")
			.max(20, "El teléfono no puede superar 20 caracteres.")
			.regex(/^\+?[0-9]{6,15}$/, "Ingresa solo números; puedes incluir el prefijo +."),
		address: z
			.string()
			.trim()
			.min(5, "Ingresa tu dirección (mínimo 5 caracteres).")
			.max(500, "La dirección no puede superar 500 caracteres."),
		orderNumber: z.string().trim().max(50, "El número de pedido no puede superar 50 caracteres."),
		isMinor: z.boolean(),
		guardianName: z.string().trim().max(255, "El nombre no puede superar 255 caracteres."),
		guardianDocNumber: z.string().trim().max(20, "El documento no puede superar 20 caracteres."),
		description: z
			.string()
			.trim()
			.min(10, "Describe el detalle con al menos 10 caracteres.")
			.max(5000, "El detalle no puede superar 5000 caracteres."),
		request: z
			.string()
			.trim()
			.min(10, "Indica tu solicitud con al menos 10 caracteres.")
			.max(5000, "La solicitud no puede superar 5000 caracteres."),
	})
	.superRefine((data, ctx) => {
		if (!data.isMinor) return;

		if (data.guardianName.trim().length < 3) {
			ctx.addIssue({
				code: "custom",
				path: ["guardianName"],
				message: "Ingresa el nombre del padre, madre o tutor (mínimo 3 caracteres).",
			});
		}
		if (data.guardianDocNumber.trim().length < 4) {
			ctx.addIssue({
				code: "custom",
				path: ["guardianDocNumber"],
				message: "Ingresa el documento del padre, madre o tutor (mínimo 4 caracteres).",
			});
		}
	});

export type ComplaintFormValues = z.infer<typeof complaintSchema>;

export const COMPLAINT_TYPE_OPTIONS = [
	{
		value: "reclamo",
		label: "Reclamo",
		hint: "Exiges la corrección de un producto o servicio (disconformidad con el bien o servicio).",
	},
	{
		value: "queja",
		label: "Queja",
		hint: "Manifiestas malestar respecto a la atención al público, sin cuestionar el producto o servicio.",
	},
] as const;

export const DOC_TYPE_OPTIONS = [
	{ value: "DNI", label: "DNI" },
	{ value: "CE", label: "Carné de extranjería" },
	{ value: "RUC", label: "RUC" },
	{ value: "PASAPORTE", label: "Pasaporte" },
] as const;

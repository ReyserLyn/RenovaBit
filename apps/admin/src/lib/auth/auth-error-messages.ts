import { authClient } from "./auth-client";

type ErrorTypes = Partial<Record<keyof typeof authClient.$ERROR_CODES, string>>;

const errorCodes = {
	USER_NOT_FOUND: "Usuario no encontrado.",
	FAILED_TO_CREATE_USER: "Error al crear el usuario.",
	FAILED_TO_CREATE_SESSION: "Error al iniciar sesión.",
	FAILED_TO_UPDATE_USER: "Error al actualizar el usuario.",
	FAILED_TO_GET_SESSION: "Error al obtener la sesión.",
	INVALID_PASSWORD: "La contraseña es incorrecta.",
	INVALID_EMAIL: "El correo electrónico no es válido.",
	INVALID_EMAIL_OR_PASSWORD: "Correo o contraseña incorrectos.",
	INVALID_USERNAME_OR_PASSWORD: "Usuario o contraseña incorrectos.",
	INVALID_USERNAME: "Nombre de usuario no válido.",
	INVALID_USER: "Usuario no válido.",
	USERNAME_IS_ALREADY_TAKEN: "Este nombre de usuario ya está en uso.",
	USER_ALREADY_EXISTS: "Ya existe una cuenta con este correo.",
	EMAIL_NOT_VERIFIED: "El correo electrónico no está verificado.",
	EMAIL_ALREADY_VERIFIED: "El correo electrónico ya fue verificado.",
	PASSWORD_TOO_SHORT: "La contraseña debe tener al menos 8 caracteres.",
	PASSWORD_TOO_LONG: "La contraseña es demasiado larga.",
	PASSWORD_ALREADY_SET: "El usuario ya tiene una contraseña.",
	USER_EMAIL_NOT_FOUND: "No se encontró una cuenta con este correo.",
	CREDENTIAL_ACCOUNT_NOT_FOUND: "Cuenta no encontrada.",
	ACCOUNT_NOT_FOUND: "Cuenta no encontrada.",
	SESSION_EXPIRED: "La sesión expiró. Inicia sesión de nuevo.",
	SESSION_NOT_FRESH: "La sesión no es reciente. Inicia sesión de nuevo.",
	INVALID_TOKEN: "El token no es válido o ya expiró.",
	TOKEN_EXPIRED: "El token expiró. Solicita uno nuevo.",
	VALIDATION_ERROR: "Error de validación. Revisa los datos ingresados.",
	MISSING_FIELD: "Completa todos los campos requeridos.",
	FAILED_TO_CREATE_VERIFICATION: "Error al crear la verificación.",
	EMAIL_CAN_NOT_BE_UPDATED: "El correo no se puede modificar.",
	INVALID_ORIGIN: "Origen de la solicitud no permitido.",
	INVALID_CALLBACK_URL: "URL de redirección no válida.",
	PROVIDER_NOT_FOUND: "Proveedor de autenticación no encontrado.",
	CALLBACK_URL_REQUIRED: "Se requiere una URL de redirección.",
} satisfies ErrorTypes;

export function translateError(code: string | undefined | null): string {
	if (!code) return "Error inesperado";

	if (code === "Failed to fetch") return "Error de conexión. Verifica tu internet.";

	return errorCodes[code as keyof typeof errorCodes] ?? code;
}

export function getAuthMessage(
	error: { message?: string; code?: string } | Error | null | undefined,
): string {
	if (error == null) return translateError(null);
	if (error instanceof Error) return translateError(error.message);
	return translateError(error.code ?? error.message);
}

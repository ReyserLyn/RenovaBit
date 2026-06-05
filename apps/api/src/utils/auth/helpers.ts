import { auth } from "./auth";

/**
 * Obtiene el ID del usuario desde la sesión activa.
 * Útil en handlers admin donde necesitas el userId para
 * operaciones CRUD (createdBy, updatedBy).
 *
 * Retorna string vacío si no hay sesión (el guard isAdmin
 * ya garantiza que haya sesión, así que esto es seguro).
 */
export async function getUserId(request: Request): Promise<string> {
	const session = await auth.api.getSession({ headers: request.headers });
	return session?.user.id ?? "";
}

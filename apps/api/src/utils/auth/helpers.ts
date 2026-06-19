import type { Role } from "@renovabit/pricing";
import { auth } from "./auth";

/**
 * Obtiene el ID del usuario desde la sesión activa.
 * Útil en handlers admin donde necesitas el userId para
 * operaciones CRUD (createdBy, updatedBy).
 *
 * Retorna null si no hay sesión (los callers deben manejar null).
 */
export async function getUserId(request: Request): Promise<string | null> {
	const session = await auth.api.getSession({ headers: request.headers });
	return session?.user.id ?? null;
}

/**
 * Obtiene el rol del usuario desde la sesión activa. Si no hay sesión
 * (request anónimo), retorna 'customer' como default (precio público).
 *
 * Usado en endpoints públicos (list, detail, search) para calcular
 * el precio que el visitante debe ver.
 */
export async function getUserRole(request: Request): Promise<Role> {
	const session = await auth.api.getSession({ headers: request.headers });
	const role = session?.user.role;
	if (role === "admin" || role === "distributor" || role === "customer") {
		return role;
	}
	return "customer";
}

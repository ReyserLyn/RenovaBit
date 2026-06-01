import type { UserInfo } from "../model";

export function getUserDisplayName(user: UserInfo | null): string {
	if (!user) return "—";
	return user.displayUsername || user.username || user.email || user.id;
}

export function getUserInitials(user: UserInfo | null): string {
	if (!user) return "?";
	const name = user.displayUsername || user.username || user.email;
	if (!name) return "?";
	return name.slice(0, 2).toUpperCase();
}

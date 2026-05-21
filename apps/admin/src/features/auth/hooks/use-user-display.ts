import { User } from "@/shared/lib/auth/auth-client";

export type UserDisplay = {
	displayName: string;
	showEmailSecondary: boolean;
	avatarFallback: string;
	email: string;
};

export function useUserDisplay(user: User): UserDisplay {
	const nameTrimmed = user.name?.trim() ?? "";
	const emailTrimmed = user.email?.trim() ?? "";
	const displayName = nameTrimmed || emailTrimmed || "Usuario";
	const showEmailSecondary = Boolean(nameTrimmed && emailTrimmed);
	const avatarFallback =
		nameTrimmed.slice(0, 1).toUpperCase() || emailTrimmed.slice(0, 1).toUpperCase() || "?";

	return {
		displayName,
		showEmailSecondary,
		avatarFallback,
		email: emailTrimmed,
	};
}

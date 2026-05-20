import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/auth-client";
import { getAuthMessage } from "@/lib/auth/auth-error-messages";
import {
	authKeys,
	authSessionQueryOptions,
	invalidateAuthQueries,
	resetAuthState,
} from "@/lib/auth/auth-session";
import type { LoginFormValues } from "../model";

export function useLogin() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationKey: [...authKeys.all, "login"],
		mutationFn: async (credentials: LoginFormValues) => {
			const { emailOrUsername, password } = credentials;
			const isEmail = emailOrUsername.includes("@");

			const result = isEmail
				? await authClient.signIn.email({ email: emailOrUsername.trim(), password })
				: await authClient.signIn.username({
						username: emailOrUsername.trim().toLowerCase(),
						password,
					});

			if (result.error) throw result.error;

			await invalidateAuthQueries(queryClient);

			const session = await queryClient.fetchQuery(authSessionQueryOptions());
			if (session?.user?.role !== "admin") {
				await authClient.signOut();
				await resetAuthState(queryClient);
				throw new Error("No tienes permisos para acceder al panel de administración");
			}

			return result.data;
		},
		onSuccess: () => {
			toast.success("Has iniciado sesión correctamente");
		},
		onError: (error: Error) => {
			toast.error(getAuthMessage(error));
		},
	});
}

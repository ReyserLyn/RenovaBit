import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authClient } from "@/shared/lib/auth/auth-client";
import { getAuthMessage } from "@/shared/lib/auth/auth-error-messages";
import { authKeys, invalidateAuthQueries } from "@/shared/lib/auth/auth-session";

export function useRegister() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationKey: [...authKeys.all, "register"],
		mutationFn: async (data: {
			email: string;
			password: string;
			name: string;
			lastname: string;
			phone?: string;
			username?: string;
		}) => {
			const result = await authClient.signUp.email({
				email: data.email.trim(),
				password: data.password,
				name: data.name.trim(),
				lastname: data.lastname.trim(),
				phone: data.phone?.trim() || undefined,
				username: data.username?.trim().toLowerCase() || undefined,
			});

			if (result.error) throw result.error;

			await invalidateAuthQueries(queryClient);
			return result.data;
		},
		onSuccess: () => {
			toast.success("Cuenta creada correctamente");
		},
		onError: (error: Error) => {
			toast.error(getAuthMessage(error));
		},
	});
}
